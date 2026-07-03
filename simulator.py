#!/usr/bin/env python3
import json
import time
import random
import urllib.request
import urllib.error
from datetime import datetime, timezone

# Rooms configuration
ROOMS = ["drawing", "work1", "work2"]
ROOM_NAMES = {
    "drawing": "Drawing Room",
    "work1": "Work Room 1",
    "work2": "Work Room 2"
}

def probe_base_url():
    """Probe ports 3000 to 3005 dynamically to find where Next.js is running"""
    print("[SYSTEM] Probing active Next.js dev server port...")
    for port in range(3000, 3006):
        url = f"http://localhost:{port}/api/simulate"
        try:
            req = urllib.request.Request(url, method="GET")
            with urllib.request.urlopen(req, timeout=1) as response:
                if response.status == 200:
                    print(f"[SYSTEM] Detected Next.js server running on: http://localhost:{port}")
                    return f"http://localhost:{port}"
        except Exception:
            continue
    print("[SYSTEM] Could not auto-detect server on ports 3000-3005. Defaulting to http://localhost:3000")
    return "http://localhost:3000"

def make_request(url, data=None, method="GET"):
    """Helper to perform HTTP requests using standard urllib"""
    req = urllib.request.Request(url, method=method)
    req.add_header("Content-Type", "application/json")
    
    body = None
    if data:
        body = json.dumps(data).encode("utf-8")
        
    try:
        with urllib.request.urlopen(req, data=body) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.URLError as e:
        print(f"[HTTP ERROR] Failed to connect to {url}: {e}")
        return None

def main():
    base_url = probe_base_url()
    simulate_url = f"{base_url}/api/simulate"
    alerts_url = f"{base_url}/api/alerts"

    print("=" * 60)
    print("      WATTWATCH — OFFICE HARDWARE SIMULATOR THREAD      ")
    print("=" * 60)
    print(f"Target Server: {base_url}")
    print("Press Ctrl+C to terminate simulation.\n")

    # Initial state
    today_kwh = 4.85
    occupancy_states = {r: True for r in ROOMS}

    while True:
        # 1. Randomly transition occupancy status for each room
        for r in ROOMS:
            # 25% chance to toggle occupancy state on each loop iteration
            if random.random() < 0.25:
                occupancy_states[r] = not occupancy_states[r]

        # 2. Pick a random room and toggle its occupancy on the server
        # This will broadcast updates to the web client via SSE
        target_room = random.choice(ROOMS)
        is_occupied = occupancy_states[target_room]
        
        payload = {
            "room": target_room,
            "isOccupied": is_occupied,
            "todayKwh": round(today_kwh, 5)
        }
        
        server_state = make_request(simulate_url, payload, method="POST")
        if not server_state:
            print("[SIMULATOR] API server is unreachable. Retrying in 5s...")
            time.sleep(5)
            continue
            
        devices = server_state.get("devices", [])
        current_occupancy = server_state.get("occupancy", occupancy_states)
        
        # Keep local occupancy states in sync with server response
        for r in ROOMS:
            if r in current_occupancy:
                occupancy_states[r] = current_occupancy[r]

        print(f"[{datetime.now().strftime('%H:%M:%S')}] Occupancy Status:")
        for r in ROOMS:
            status_text = "OCCUPIED" if occupancy_states[r] else "VACANT"
            print(f"  - {ROOM_NAMES[r]}: {status_text}")

        # 3. Check Rules & Trigger Alerts
        now = datetime.now()
        
        # Rule A: Empty Room Warning
        # If room is VACANT, but has devices running, trigger warning alert
        for r in ROOMS:
            room_vacant = not occupancy_states.get(r, False)
            if room_vacant:
                room_devices = [d for d in devices if d.get("room") == r]
                active_devices = [d for d in room_devices if d.get("status") == "on"]
                
                if active_devices:
                    device_labels = ", ".join([d.get("label") for d in active_devices])
                    alert_msg = f"Empty Room Warning: {ROOM_NAMES[r]} is unoccupied, but [{device_labels}] are still running! Turn off room electricity."
                    print(f"  [ALERT TRIGGERED] {alert_msg}")
                    
                    alert_payload = {
                        "severity": "warning",
                        "message": alert_msg,
                        "room": r
                    }
                    make_request(alerts_url, alert_payload, method="POST")

        # Rule B: Devices active after office hours (outside 9 AM - 5 PM)
        current_hour = now.hour
        is_after_hours = current_hour >= 17 or current_hour < 9
        
        if is_after_hours:
            active_devices = [d for d in devices if d.get("status") == "on"]
            for d in active_devices:
                alert_msg = f"After-Hours Alert: {ROOM_NAMES[d.get('room')]} {d.get('label')} is left active at {now.strftime('%I:%M %p')} (outside 9AM-5PM office hours)."
                print(f"  [ALERT TRIGGERED] {alert_msg}")
                
                alert_payload = {
                    "severity": "warning",
                    "message": alert_msg,
                    "room": d.get("room")
                }
                make_request(alerts_url, alert_payload, method="POST")

        # Rule C: Room overrun timing calculation
        # A room where ALL devices have been on for more than 2 hours continuously.
        # (For simulation demonstration, we treat 30 seconds of continuous runtime as 2 hours)
        for r in ROOMS:
            room_devices = [d for d in devices if d.get("room") == r]
            if not room_devices:
                continue
                
            all_devices_on = all([d.get("status") == "on" for d in room_devices])
            
            if all_devices_on:
                elapsed_times = []
                for d in room_devices:
                    last_changed_str = d.get("lastChanged")
                    try:
                        # Parse ISO timestamp
                        last_changed = datetime.fromisoformat(last_changed_str.replace("Z", "+00:00"))
                        now_utc = datetime.now(timezone.utc)
                        elapsed_seconds = (now_utc - last_changed).total_seconds()
                        elapsed_times.append(elapsed_seconds)
                    except Exception as ex:
                        print(f"Error parsing timestamp for {d.get('id')}: {ex}")
                
                if elapsed_times:
                    # Continuous duration is determined by the device turned ON most recently
                    continuous_duration = min(elapsed_times)
                    
                    SIMULATED_2_HOURS = 30 # 30s threshold translates to 2 hours overrun
                    if continuous_duration > SIMULATED_2_HOURS:
                        alert_msg = f"Critical Overrun: All devices in {ROOM_NAMES[r]} have been ON continuously for > 2 hours!"
                        print(f"  [ALERT TRIGGERED] {alert_msg}")
                        
                        alert_payload = {
                            "severity": "critical",
                            "message": alert_msg,
                            "room": r
                        }
                        make_request(alerts_url, alert_payload, method="POST")

        # 4. Increment simulated kWh cumulative consumption in background
        active_load_watts = sum([d.get("wattage", 0) for d in devices if d.get("status") == "on"])
        current_draw = active_load_watts if active_load_watts > 0 else 120  # ambient baseline
        
        # Add energy drawn during this sleep cycle (4 seconds)
        kwh_increment = (current_draw * 4) / (3600 * 1000)
        today_kwh += kwh_increment
        
        print(f"  Active Load: {active_load_watts}W | Cumulative energy: {today_kwh:.5f} kWh")
        print("-" * 60)
        
        # Sleep for 4 seconds before next loop
        time.sleep(4)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nSimulator stopped by user.")
