import os
import json
import time
import random
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

BD_TZ = timezone(timedelta(hours=6))  # Bangladesh Standard Time = UTC+6

# Load environmental configs
load_dotenv()

# Rooms configuration
ROOMS = ["drawing", "work1", "work2"]
ROOM_NAMES = {
    "drawing": "Drawing Room",
    "work1": "Work Room 1",
    "work2": "Work Room 2"
}

EMPTY_ROOM_ALERT_DELAY_SECONDS = 15 * 60
MAX_OCCUPANTS_PER_ROOM = 4

def next_occupancy_delay(occupant_count):
    return random.uniform(6 * 60, 12 * 60) if occupant_count > 0 else random.uniform(3 * 60, 7 * 60)

def next_device_telemetry_delay():
    return random.uniform(4 * 60, 9 * 60)

def clamp_occupant_count(value):
    return max(0, min(MAX_OCCUPANTS_PER_ROOM, int(round(value))))

def to_occupant_count(value):
    if isinstance(value, bool):
        return 1 if value else 0
    if isinstance(value, (int, float)):
        return clamp_occupant_count(value)
    return 0

def next_occupant_count(current_count):
    current = clamp_occupant_count(current_count)
    if current == 0:
        return 1
    if current == MAX_OCCUPANTS_PER_ROOM:
        return MAX_OCCUPANTS_PER_ROOM - 1
    return clamp_occupant_count(current + (1 if random.random() > 0.45 else -1))

def is_optional_device(device):
    return not (
        (device.get("type") == "fan" and device.get("label") == "Fan 1") or
        (device.get("type") == "light" and device.get("label") == "Light 1")
    )

def probe_base_url():
    """Probe ports 3000 to 3005 dynamically to find where Next.js is running, or read from env"""
    env_url = os.getenv("NEXT_PUBLIC_API_URL")
    if env_url:
        print(f"[SYSTEM] Using target API URL from .env: {env_url}")
        return env_url

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
    devices_url = f"{base_url}/api/devices"

    print("=" * 60)
    print("      WATTWATCH — OFFICE HARDWARE SIMULATOR THREAD      ")
    print("=" * 60)
    print(f"Target Server: {base_url}")
    print("Press Ctrl+C to terminate simulation.\n")

    # Initial state
    today_kwh = 4.85
    occupancy_states = {"drawing": 1, "work1": 3, "work2": 2}
    
    # Track when a room became empty (vacant)
    # vacant_since[room] stores unix timestamp if empty, else None
    vacant_since = {r: None for r in ROOMS}
    
    # Avoid duplicate alerts firing in a row
    triggered_vacant_alerts = {r: False for r in ROOMS}
    next_occupancy_transition_at = {
        r: time.time() + next_occupancy_delay(occupancy_states[r])
        for r in ROOMS
    }
    next_device_telemetry_at = {
        r: time.time() + next_device_telemetry_delay()
        for r in ROOMS
    }
    last_time_alert_triggered = None

    while True:
        now_ts = time.time()

        # 1. Slow office occupancy simulation: minutes-scale, never twitchy.
        for r in ROOMS:
            if now_ts < next_occupancy_transition_at[r]:
                continue

            previous_count = occupancy_states[r]
            occupancy_states[r] = next_occupant_count(previous_count)
            next_occupancy_transition_at[r] = now_ts + next_occupancy_delay(occupancy_states[r])

            if previous_count > 0 and occupancy_states[r] == 0:
                print(f"  >>> [Simulator] People left {ROOM_NAMES[r]}. Starting 15-minute countdown.")
                vacant_since[r] = now_ts
                triggered_vacant_alerts[r] = False
            elif previous_count == 0 and occupancy_states[r] > 0:
                print(f"  >>> [Simulator] People entered {ROOM_NAMES[r]}. Countdown reset.")
                vacant_since[r] = None
                triggered_vacant_alerts[r] = False
            else:
                print(f"  >>> [Simulator] {ROOM_NAMES[r]} people count -> {occupancy_states[r]}")

        # 2. Sync occupancy status to server.
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

        # 3. Slow optional device telemetry. Baseline Fan 1 / Light 1 are left stable.
        for r in ROOMS:
            if time.time() < next_device_telemetry_at[r]:
                continue
            next_device_telemetry_at[r] = time.time() + next_device_telemetry_delay()

            optional_devices = [
                d for d in devices
                if d.get("room") == r and is_optional_device(d)
            ]
            if not optional_devices:
                continue

            device = random.choice(optional_devices)
            next_status = "off" if device.get("status") == "on" else "on"
            make_request(
                devices_url,
                {"id": device.get("id"), "status": next_status},
                method="POST"
            )
            print(f"  >>> [Simulator] {ROOM_NAMES[r]} {device.get('label')} telemetry -> {next_status.upper()}")
        
        # Sync local dictionary with server state
        for r in ROOMS:
            if r in current_occupancy:
                # If server state changed (e.g. overridden by toggles), capture transition
                next_count = to_occupant_count(current_occupancy[r])
                if occupancy_states[r] != next_count:
                    occupancy_states[r] = next_count
                    if occupancy_states[r] == 0:
                        vacant_since[r] = time.time()
                        triggered_vacant_alerts[r] = False
                    else:
                        vacant_since[r] = None
                        triggered_vacant_alerts[r] = False

        print(f"[{datetime.now().strftime('%H:%M:%S')}] Occupancy Status:")
        for r in ROOMS:
            status_text = f"{occupancy_states[r]} HUMAN(S)" if occupancy_states[r] > 0 else "VACANT"
            print(f"  - {ROOM_NAMES[r]}: {status_text}")

        # 3. Check Rules & Trigger Alerts
        now = datetime.now()
        
        # Rule A: Empty Room Warning with 15-Minute Countdown
        # (900 seconds = 15 minutes real office time)
        SIMULATED_15_MINUTES = EMPTY_ROOM_ALERT_DELAY_SECONDS
        
        for r in ROOMS:
            room_vacant = occupancy_states.get(r, 0) <= 0
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
            else:
                vacant_since[r] = None
                triggered_vacant_alerts[r] = False

        # Rule B: Proactive after-hours consolidated check — uses Bangladesh time (UTC+6)
        #          so it works correctly whether running locally or on a UTC server (Render).
        now_bd = datetime.now(BD_TZ)
        should_trigger = False
        time_formatted = ""
        time_key = f"{now_bd.hour}:{now_bd.minute}"

        # Testing range: 3:30 PM to 5:00 PM BD time (15:30 to 16:59)
        if now_bd.hour == 15 and now_bd.minute >= 30:
            if now_bd.minute % 5 == 0:
                should_trigger = True
                display_hour = now_bd.hour % 12 if now_bd.hour % 12 != 0 else 12
                display_minute = f"0{now_bd.minute}" if now_bd.minute < 10 else now_bd.minute
                time_formatted = f"{display_hour}:{display_minute} PM"
        elif now_bd.hour == 16:
            if now_bd.minute % 5 == 0:
                should_trigger = True
                display_hour = now_bd.hour % 12 if now_bd.hour % 12 != 0 else 12
                display_minute = f"0{now_bd.minute}" if now_bd.minute < 10 else now_bd.minute
                time_formatted = f"{display_hour}:{display_minute} PM"
        # Production range: after-hours outside 9:00 AM - 5:00 PM BD time
        elif now_bd.hour >= 17 or now_bd.hour < 9:
            if now_bd.minute == 0:
                should_trigger = True
                ampm = 'PM' if now_bd.hour >= 12 else 'AM'
                display_hour = now_bd.hour % 12 if now_bd.hour % 12 != 0 else 12
                time_formatted = f"{display_hour} {ampm}"

        if should_trigger and last_time_alert_triggered != time_key:
            last_time_alert_triggered = time_key
            for r in ROOMS:
                room_devices = [d for d in devices if d.get("room") == r]
                active_devs = [d for d in room_devices if d.get("status") == "on"]
                if active_devs:
                    fans = sum(1 for d in active_devs if d.get("type") == "fan")
                    lights = sum(1 for d in active_devs if d.get("type") == "light")
                    
                    parts_list = []
                    if fans > 0:
                        parts_list.append(f"{fans} fan{'s' if fans > 1 else ''}")
                    if lights > 0:
                        parts_list.append(f"{lights} light{'s' if lights > 1 else ''}")
                    device_description = " and ".join(parts_list)
                    
                    alert_msg = f"⚠️ Hey! {ROOM_NAMES[r]} still has {device_description} ON and it's {time_formatted}. Did someone forget to leave?"
                    print(f"  [ALERT TRIGGERED] {alert_msg}")
                    
                    alert_payload = {
                        "severity": "warning",
                        "message": alert_msg,
                        "room": r
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
