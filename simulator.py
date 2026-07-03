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
    
    # Track when a room became empty (vacant)
    # vacant_since[room] stores unix timestamp if empty, else None
    vacant_since = {r: None for r in ROOMS}
    
    # Avoid duplicate alerts firing in a row
    triggered_vacant_alerts = {r: False for r in ROOMS}

    while True:
        # 1. Randomly transition occupancy status for each room
        for r in ROOMS:
            # 30% chance to toggle occupancy status
            if random.random() < 0.30:
                was_occupied = occupancy_states[r]
                occupancy_states[r] = not occupancy_states[r]
                
                # Print transitions to help trace timing
                if was_occupied and not occupancy_states[r]:
                    print(f"  >>> [Simulator] All people have left {ROOM_NAMES[r]}. Starting 15-minute countdown.")
                    vacant_since[r] = time.time()
                    triggered_vacant_alerts[r] = False
                elif not was_occupied and occupancy_states[r]:
                    print(f"  >>> [Simulator] Human entered {ROOM_NAMES[r]}. Countdown reset.")
                    vacant_since[r] = None
                    triggered_vacant_alerts[r] = False

        # 2. Sync full occupancy status to server to trigger client updates
        payload = {
            "occupancy": occupancy_states,
            "todayKwh": round(today_kwh, 5)
        }
        
        server_state = make_request(simulate_url, payload, method="POST")
        if not server_state:
            print("[SIMULATOR] API server is unreachable. Retrying in 5s...")
            time.sleep(5)
            continue
            
        devices = server_state.get("devices", [])
        current_occupancy = server_state.get("occupancy", occupancy_states)
        
        # Sync local dictionary with server state
        for r in ROOMS:
            if r in current_occupancy:
                # If server state changed (e.g. overridden by toggles), capture transition
                if occupancy_states[r] != current_occupancy[r]:
                    occupancy_states[r] = current_occupancy[r]
                    if not occupancy_states[r]:
                        vacant_since[r] = time.time()
                        triggered_vacant_alerts[r] = False
                    else:
                        vacant_since[r] = None
                        triggered_vacant_alerts[r] = False

        print(f"[{datetime.now().strftime('%H:%M:%S')}] Occupancy Status:")
        for r in ROOMS:
            status_text = "OCCUPIED" if occupancy_states[r] else "VACANT"
            print(f"  - {ROOM_NAMES[r]}: {status_text}")

        # 3. Check Rules & Trigger Alerts
        now = datetime.now()
        
        # Rule A: Empty Room Warning with 15-Minute Countdown
        # (15 seconds simulated time = 15 minutes real office time)
        SIMULATED_15_MINUTES = 15.0  # 15 seconds
        
        for r in ROOMS:
            room_vacant = not occupancy_states.get(r, False)
            if room_vacant:
                room_devices = [d for d in devices if d.get("room") == r]
                active_devices = [d for d in room_devices if d.get("status") == "on"]
                
                # Check if there are active devices
                if active_devices:
                    if vacant_since[r] is None:
                        # Fallback if timestamp was lost
                        vacant_since[r] = time.time()
                    
                    elapsed = time.time() - vacant_since[r]
                    device_labels = ", ".join([d.get("label") for d in active_devices])
                    
                    if elapsed >= SIMULATED_15_MINUTES:
                        if not triggered_vacant_alerts[r]:
                            alert_msg = f"Electricity Waste Alert: {ROOM_NAMES[r]} has been unoccupied for 15 minutes, but [{device_labels}] are still ON! Turn off room electricity."
                            print(f"  [ALERT TRIGGERED] {alert_msg}")
                            
                            alert_payload = {
                                "severity": "warning",
                                "message": alert_msg,
                                "room": r
                            }
                            make_request(alerts_url, alert_payload, method="POST")
                            triggered_vacant_alerts[r] = True
                        else:
                            print(f"  - {ROOM_NAMES[r]} empty for {int(elapsed)}s. Alert already triggered.")
                    else:
                        remaining = int(SIMULATED_15_MINUTES - elapsed)
                        print(f"  - {ROOM_NAMES[r]} empty for {int(elapsed)}s. Triggering alert in {remaining}s.")
                else:
                    # No devices on, reset state
                    vacant_since[r] = None
                    triggered_vacant_alerts[r] = False

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

        # Rule C: Room overrun timing calculation (All devices in a room on for > 2h continuous)
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
                        last_changed = datetime.fromisoformat(last_changed_str.replace("Z", "+00:00"))
                        now_utc = datetime.now(timezone.utc)
                        elapsed_seconds = (now_utc - last_changed).total_seconds()
                        elapsed_times.append(elapsed_seconds)
                    except Exception as ex:
                        print(f"Error parsing timestamp for {d.get('id')}: {ex}")
                
                if elapsed_times:
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
