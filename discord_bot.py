import os
import json
import asyncio
import aiohttp
import discord
import threading
from discord.ext import commands
from dotenv import load_dotenv
from http.server import SimpleHTTPRequestHandler, HTTPServer

# Load environmental configs
load_dotenv()

TOKEN = os.getenv("DISCORD_BOT_TOKEN")
ALERT_CHANNEL_ID = os.getenv("DISCORD_ALERT_CHANNEL_ID")
API_BASE_URL = os.getenv("NEXT_PUBLIC_API_URL", "http://localhost:3000")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# Intents
intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix="!", intents=intents)

# Tiny dummy HTTP Server to satisfy Render Free Web Service health checks
class HealthCheckHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/':
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"OK")
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        # Mute logging to keep console clean
        pass

def run_health_check_server():
    port = int(os.getenv("PORT", 8080))
    server = HTTPServer(("0.0.0.0", port), HealthCheckHandler)
    print(f"[HealthCheck] Running dummy HTTP server on port {port} for Render Free Web Service...")
    server.serve_forever()

async def ask_llm(prompt: str) -> str:
    """Friendly conversational helper utilizing Gemini 2.5 Flash or Groq Llama-3 API"""
    if GEMINI_API_KEY:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}]
        }
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload, headers={"Content-Type": "application/json"}) as response:
                    if response.status == 200:
                        data = await response.json()
                        return data["candidates"][0]["content"]["parts"][0]["text"].strip()
        except Exception as e:
            print(f"[LLM] Gemini request failed: {e}")

    if GROQ_API_KEY:
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "llama3-8b-8192",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.7
        }
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload, headers=headers) as response:
                    if response.status == 200:
                        data = await response.json()
                        return data["choices"][0]["message"]["content"].strip()
        except Exception as e:
            print(f"[LLM] Groq request failed: {e}")

    return ""

async def listen_to_sse():
    """Async task connecting to Next.js API stream to broadcast live alerts to Discord"""
    await bot.wait_until_ready()
    if not ALERT_CHANNEL_ID:
        print("[Bot] DISCORD_ALERT_CHANNEL_ID not set. Real-time alert listener disabled.")
        return

    channel_id = int(ALERT_CHANNEL_ID)
    channel = bot.get_channel(channel_id)
    if not channel:
        print(f"[Bot] Alert channel with ID {channel_id} not found in cache. Waiting...")
        await asyncio.sleep(5)
        channel = bot.get_channel(channel_id)

    if not channel:
        print(f"[Bot] Critical Error: Target alert channel {channel_id} not found.")
        return

    stream_url = f"{API_BASE_URL}/api/stream"
    print(f"[Bot] Alert listener connecting to SSE: {stream_url}")
    
    while not bot.is_closed():
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(stream_url, headers={"Accept": "text/event-stream"}) as response:
                    async for line_bytes in response.content:
                        line = line_bytes.decode('utf-8').strip()
                        if line.startswith("data:"):
                            try:
                                event = json.loads(line[5:])
                                if event.get("type") == "alert":
                                    payload = event.get("payload", {})
                                    severity = payload.get("severity", "warning").upper()
                                    message = payload.get("message", "Anomaly detected.")
                                    
                                    embed = discord.Embed(
                                        title=f"⚠️ {severity} ALERT: Office Anomaly",
                                        description=message,
                                        color=discord.Color.red() if severity == "CRITICAL" else discord.Color.orange()
                                    )
                                    embed.set_footer(text=f"Timestamp: {payload.get('timestamp')}")
                                    await channel.send(embed=embed)
                            except Exception as parse_err:
                                print(f"[SSE] Parse error: {parse_err}")
        except Exception as conn_err:
            print(f"[SSE] Connection error: {conn_err}. Retrying in 5 seconds...")
            await asyncio.sleep(5)

@bot.event
async def on_ready():
    print(f"[Bot] Logged in as {bot.user.name} ({bot.user.id})")
    bot.loop.create_task(listen_to_sse())

@bot.command(name="status")
async def cmd_status(ctx):
    """Answers status of all rooms and devices"""
    async with ctx.typing():
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{API_BASE_URL}/api/simulate") as response:
                    if response.status != 200:
                        await ctx.send("❌ Failed to query backend API.")
                        return
                    data = await response.json()
                    
            devices = data.get("devices", [])
            occupancy = data.get("occupancy", {})
            
            rooms_map = {
                "drawing": "Drawing Room",
                "work1": "Work Room 1",
                "work2": "Work Room 2"
            }
            
            lines = []
            for room_key, room_name in rooms_map.items():
                room_devs = [d for d in devices if d.get("room") == room_key]
                active_fans = sum(1 for d in room_devs if d.get("type") == "fan" and d.get("status") == "on")
                active_lights = sum(1 for d in room_devs if d.get("type") == "light" and d.get("status") == "on")
                
                if active_fans == 0 and active_lights == 0:
                    status_desc = "all OFF"
                else:
                    parts = []
                    if active_fans > 0:
                        parts.append(f"{active_fans} fan{'s' if active_fans > 1 else ''} ON")
                    if active_lights > 0:
                        parts.append(f"{active_lights} light{'s' if active_lights > 1 else ''} ON")
                    status_desc = ", ".join(parts)
                
                people = occupancy.get(room_key, 0)
                occ_desc = f"({people} occupant{'s' if people != 1 else ''})" if people > 0 else "(vacant)"
                lines.append(f"• **{room_name}**: {status_desc} {occ_desc}.")

            raw_status_str = "\n".join(lines)
            
            # Conversational formatting
            prompt = f"Format this raw smart office device status into a friendly, helpful, conversational summary for Discord:\n{raw_status_str}"
            friendly_text = await ask_llm(prompt)
            
            if friendly_text:
                await ctx.send(friendly_text)
            else:
                fallback_reply = (
                    "👋 **Here is the current office device status:**\n\n"
                    f"{raw_status_str}\n"
                    "Let me know if you want me to turn anything off!"
                )
                await ctx.send(fallback_reply)
        except Exception as e:
            await ctx.send(f"❌ Error getting status: {e}")

@bot.command(name="room")
async def cmd_room(ctx, *, room_name: str = ""):
    """Answers status of a specific room (e.g. !room work1 or !room drawing)"""
    async with ctx.typing():
        room_name_cleaned = room_name.lower().replace(" ", "")
        
        # Map input to room keys
        room_key = None
        if "draw" in room_name_cleaned:
            room_key = "drawing"
        elif "work1" in room_name_cleaned or "workroom1" in room_name_cleaned:
            room_key = "work1"
        elif "work2" in room_name_cleaned or "workroom2" in room_name_cleaned:
            room_key = "work2"
            
        if not room_key:
            await ctx.send("❌ Room not found. Please choose: `drawing`, `work1`, or `work2`.")
            return

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{API_BASE_URL}/api/simulate") as response:
                    if response.status != 200:
                        await ctx.send("❌ Failed to query backend API.")
                        return
                    data = await response.json()
            
            devices = data.get("devices", [])
            occupancy = data.get("occupancy", {})
            
            room_full_names = {
                "drawing": "Drawing Room",
                "work1": "Work Room 1",
                "work2": "Work Room 2"
            }
            
            room_devs = [d for d in devices if d.get("room") == room_key]
            active_devs = [d for d in room_devs if d.get("status") == "on"]
            people = occupancy.get(room_key, 0)
            
            raw_details = (
                f"Room: {room_full_names[room_key]}\n"
                f"Occupants: {people} people\n"
                f"Total Devices: {len(room_devs)}\n"
                f"Active Devices: {', '.join([d.get('label') for d in active_devs]) if active_devs else 'None'}"
            )
            
            prompt = f"Summarize this raw room telemetry into a friendly, natural chat message:\n{raw_details}"
            friendly_text = await ask_llm(prompt)
            
            if friendly_text:
                await ctx.send(friendly_text)
            else:
                devs_list = "\n".join([f"- {d.get('label')}: **{d.get('status').upper()}**" for d in room_devs])
                fallback_reply = (
                    f"🏢 **{room_full_names[room_key]} Telemetry:**\n"
                    f"Occupants: `{people}`\n"
                    f"Devices:\n{devs_list}"
                )
                await ctx.send(fallback_reply)
        except Exception as e:
            await ctx.send(f"❌ Error getting room status: {e}")

@bot.command(name="usage")
async def cmd_usage(ctx):
    """Answers total office power and energy usage metrics"""
    async with ctx.typing():
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{API_BASE_URL}/api/usage") as response:
                    if response.status != 200:
                        await ctx.send("❌ Failed to query backend API.")
                        return
                    data = await response.json()
            
            total_watts = data.get("totalWattsNow", 0)
            today_kwh = data.get("todayKwh", 0.0)
            per_room = data.get("perRoom", {})
            
            raw_usage = (
                f"Current Power Draw: {total_watts}W\n"
                f"Today's Estimated Consumption: {today_kwh:.3f} kWh\n"
                f"Breakdown:\n"
                f"- Drawing Room: {per_room.get('drawing', 0)}W\n"
                f"- Work Room 1: {per_room.get('work1', 0)}W\n"
                f"- Work Room 2: {per_room.get('work2', 0)}W"
            )
            
            prompt = f"Convert this raw office power usage data into a conversational message, highlighting if we are saving energy or burning too much power (ambient base is ~120W):\n{raw_usage}"
            friendly_text = await ask_llm(prompt)
            
            if friendly_text:
                await ctx.send(friendly_text)
            else:
                fallback_reply = (
                    "⚡ **Office Energy Report:**\n"
                    f"• Current Power Draw: `{total_watts} W`\n"
                    f"• Today's Energy Used: `{today_kwh:.3f} kWh`\n"
                    "• Power Draw per room:\n"
                    f"  - Drawing Room: `{per_room.get('drawing', 0)} W`\n"
                    f"  - Work Room 1: `{per_room.get('work1', 0)} W`\n"
                    f"  - Work Room 2: `{per_room.get('work2', 0)} W`"
                )
                await ctx.send(fallback_reply)
        except Exception as e:
            await ctx.send(f"❌ Error getting energy usage: {e}")

@bot.command(name="occupants")
async def cmd_occupants(ctx):
    """Lists office members from the dummy dataset"""
    async with ctx.typing():
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{API_BASE_URL}/api/occupants") as response:
                    if response.status != 200:
                        await ctx.send("❌ Failed to query backend API.")
                        return
                    data = await response.json()
            
            lines = []
            for member in data:
                lines.append(f"• **{member.get('name')}** (Role: { 'Developer' if member.get('id') == 'nafisa' else 'Admin' })\n  ✉ {member.get('email')} | 📞 {member.get('phone')}")
            
            raw_occupants = "\n".join(lines)
            
            prompt = f"Convert this raw employee directory into a friendly chat list:\n{raw_occupants}"
            friendly_text = await ask_llm(prompt)
            
            if friendly_text:
                await ctx.send(friendly_text)
            else:
                await ctx.send("👥 **Office Members Directory:**\n\n" + raw_occupants)
        except Exception as e:
            await ctx.send(f"❌ Error getting directory: {e}")

if __name__ == "__main__":
    if not TOKEN:
        print("[CRITICAL] DISCORD_BOT_TOKEN environment variable not set!")
    else:
        # Start the dummy HTTP server to satisfy Render's health checks for free web services
        health_thread = threading.Thread(target=run_health_check_server, daemon=True)
        health_thread.start()
        
        bot.run(TOKEN)
