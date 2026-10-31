#!/usr/bin/env python3
"""
Receptor de telemetría para Forza Horizon 6 (Data Out) -> Banco de Reglajes.

Recibe los paquetes UDP del juego y los reenvía a la página por WebSocket local.
Solo usa la biblioteca estándar de Python 3.8+. No instala nada.

Uso:   python receptor-telemetria.py
       python receptor-telemetria.py --udp 9999 --ws 8777
       python receptor-telemetria.py --volcar captura.bin   (guarda 120 paquetes crudos para revisar el formato)
"""
import argparse, asyncio, base64, hashlib, json, math, socket, struct, sys, threading, time

# Diseño del paquete según la documentación oficial de Forza (FH6, 324 bytes, little-endian).
# El documento no da los desplazamientos, se derivan del orden y tipo de los campos.
# Se arma explícitamente para evitar errores de agrupación:
FMT = ("<" "iI"            # IsRaceOn, TimestampMS
       "fff"               # EngineMaxRpm, EngineIdleRpm, CurrentEngineRpm
       "fff" "fff" "fff"   # Aceleración, Velocidad, Velocidad angular
       "fff"               # Yaw, Pitch, Roll
       "ffff"              # Recorrido normalizado de suspensión
       "ffff"              # Deslizamiento longitudinal (ratio)
       "ffff"              # Velocidad de giro de rueda
       "iiii" "iiii"       # Bordillo, charco
       "ffff"              # Vibración de superficie
       "ffff"              # Ángulo de deslizamiento
       "ffff"              # Deslizamiento combinado
       "ffff"              # Recorrido de suspensión (m)
       "iiiii"             # CarOrdinal, CarClass, PI, Tracción, Cilindros
       "I" "ff"            # CarGroup, SmashableVelDiff, SmashableMass
       "fff"               # Posición
       "fff"               # Speed, Power, Torque
       "ffff"              # Temperatura de neumáticos
       "fff"               # Boost, Fuel, Distancia
       "fff" "f"           # BestLap, LastLap, CurrentLap, CurrentRaceTime
       "H" "B"             # Vuelta, Posición en carrera
       "BBBB" "B"          # Accel, Brake, Clutch, HandBrake, Gear
       "bbb")              # Steer, LíneaNormalizada, FrenadaIA
SIZE = struct.calcsize(FMT)   # 323; el paquete real mide 324 (1 byte final de relleno)

def parse(b):
    v = struct.unpack_from(FMT, b, 0)
    i = iter(v)
    n = lambda k: [next(i) for _ in range(k)]
    d = {}
    d["on"], d["ts"] = next(i), next(i)
    d["rpmMax"], d["rpmIdle"], d["rpm"] = n(3)
    d["acc"] = n(3); d["vel"] = n(3); d["angv"] = n(3); d["ypr"] = n(3)
    d["nt"] = n(4); d["sr"] = n(4); d["wrs"] = n(4); n(8); n(4)
    d["sa"] = n(4); d["cs"] = n(4); d["tm"] = n(4)
    d["ord"], d["cls"], d["pi"], d["dt"], d["cyl"] = n(5)
    n(3); n(3)
    d["spd"], d["pow"], d["tor"] = n(3)
    d["tmp"] = n(4)
    d["boost"], d["fuel"], d["dist"] = n(3)
    d["best"], d["last"], d["cur"], d["race"] = n(4)
    d["lap"], d["pos"] = next(i), next(i)
    d["gas"], d["brk"], d["clu"], d["hb"], d["gear"] = n(5)
    d["str"] = next(i); n(2)
    return d

def sane(d):
    """Comprobación de que el formato coincide: la velocidad debe ser la norma del vector de velocidad."""
    if d["spd"] < 5: return None
    nv = math.sqrt(sum(x*x for x in d["vel"]))
    if nv <= 0: return None
    return abs(nv - d["spd"]) / d["spd"] < 0.25 and 0 < d["rpmMax"] < 30000

def r(x, k=3): return round(x, k) if isinstance(x, float) and math.isfinite(x) else (0 if isinstance(x, float) else x)

def compact(d):
    return {"t": "s", "on": d["on"], "ts": d["ts"], "rpm": r(d["rpm"], 0), "rpmMax": r(d["rpmMax"], 0), "rpmIdle": r(d["rpmIdle"], 0),
            "ax": r(d["acc"][0], 2), "az": r(d["acc"][2], 2), "spd": r(d["spd"], 2), "nt": [r(x) for x in d["nt"]],
            "sr": [r(x) for x in d["sr"]], "sa": [r(x) for x in d["sa"]], "cs": [r(x) for x in d["cs"]],
            "tm": [r(x, 3) for x in d["tm"]], "tmp": [r(x, 1) for x in d["tmp"]], "ord": d["ord"], "cls": d["cls"], "pi": d["pi"],
            "dt": d["dt"], "pow": r(d["pow"], 0), "tor": r(d["tor"], 0), "boost": r(d["boost"], 2), "best": r(d["best"], 2),
            "last": r(d["last"], 2), "cur": r(d["cur"], 2), "lap": d["lap"], "gas": d["gas"], "brk": d["brk"], "gear": d["gear"],
            "str": d["str"], "yaw": r(d["angv"][1], 3)}

# ---------------- WebSocket mínimo ----------------
GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
clients = set()

def frame(txt):
    p = txt.encode()
    n = len(p)
    h = b"\x81" + (bytes([n]) if n < 126 else b"\x7e" + struct.pack(">H", n) if n < 65536 else b"\x7f" + struct.pack(">Q", n))
    return h + p

async def ws_client(reader, writer):
    try:
        head = await reader.readuntil(b"\r\n\r\n")
        key = None
        for ln in head.decode("latin1").split("\r\n"):
            if ln.lower().startswith("sec-websocket-key:"): key = ln.split(":", 1)[1].strip()
        if not key:
            writer.write(b"HTTP/1.1 200 OK\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nReceptor de telemetria activo. Abre Banco de Reglajes y conecta.\r\n")
            await writer.drain(); writer.close(); return
        acc = base64.b64encode(hashlib.sha1((key + GUID).encode()).digest()).decode()
        writer.write(("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: %s\r\n\r\n" % acc).encode())
        await writer.drain()
        clients.add(writer)
        writer.write(frame(json.dumps({"t": "hello", "ok": True}))); await writer.drain()
        while True:
            h = await reader.readexactly(2)
            op = h[0] & 0x0F; ln = h[1] & 0x7F
            if ln == 126: ln = struct.unpack(">H", await reader.readexactly(2))[0]
            elif ln == 127: ln = struct.unpack(">Q", await reader.readexactly(8))[0]
            mask = await reader.readexactly(4) if h[1] & 0x80 else None
            if ln: await reader.readexactly(ln)
            if op == 8: break
            if op == 9: writer.write(b"\x8a\x00"); await writer.drain()
    except Exception:
        pass
    finally:
        clients.discard(writer)
        try: writer.close()
        except Exception: pass

# ---------------- Bucle principal ----------------
stats = {"pk": 0, "len": 0, "bad": 0, "sane": None, "last": 0.0}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--udp", type=int, default=9999, help="puerto UDP donde escucha (el mismo que pones en el juego)")
    ap.add_argument("--ws", type=int, default=8777, help="puerto WebSocket local para la página")
    ap.add_argument("--hz", type=int, default=30, help="paquetes por segundo que se envían a la página")
    ap.add_argument("--volcar", metavar="ARCHIVO", help="guarda 120 paquetes crudos para revisar el formato")
    a = ap.parse_args()
    if 5200 <= a.udp <= 5300:
        sys.exit("Ese puerto lo usa el juego internamente. Elige otro (por ejemplo 9999).")

    loop = asyncio.new_event_loop(); asyncio.set_event_loop(loop)
    dump = open(a.volcar, "wb") if a.volcar else None
    state = {"dumped": 0, "next": 0.0}

    def push(msg):
        w = frame(json.dumps(msg, separators=(",", ":")))
        for c in list(clients):
            try: c.write(w)
            except Exception: clients.discard(c)

    def on_packet(b):
        stats["pk"] += 1; stats["len"] = len(b); stats["last"] = time.time()
        if dump and state["dumped"] < 120:
            dump.write(b); dump.flush(); state["dumped"] += 1
            if state["dumped"] == 120: print("Captura guardada en", a.volcar)
        if len(b) < SIZE:
            stats["bad"] += 1; return
        try: d = parse(b)
        except Exception:
            stats["bad"] += 1; return
        s = sane(d)
        if s is not None: stats["sane"] = s
        now = time.monotonic()
        if now >= state["next"]:
            state["next"] = now + 1.0 / a.hz
            push(compact(d))

    def udp_thread():
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        s.bind(("0.0.0.0", a.udp))
        while True:
            b, _ = s.recvfrom(2048)
            loop.call_soon_threadsafe(on_packet, b)

    async def ticker():
        while True:
            await asyncio.sleep(1)
            push({"t": "stat", "pk": stats["pk"], "len": stats["len"], "bad": stats["bad"], "sane": stats["sane"],
                  "age": round(time.time() - stats["last"], 1) if stats["last"] else None})

    async def run():
        await asyncio.start_server(ws_client, "127.0.0.1", a.ws)
        asyncio.ensure_future(ticker())
        print("Receptor listo.")
        print("  Juego   -> envía Data Out a la IP de este equipo, puerto UDP", a.udp)
        print("  Página  -> conecta a ws://127.0.0.1:%d" % a.ws)
        print("Deja esta ventana abierta mientras juegas. Ctrl+C para salir.")
        while True: await asyncio.sleep(3600)

    threading.Thread(target=udp_thread, daemon=True).start()
    try: loop.run_until_complete(run())
    except KeyboardInterrupt: pass

if __name__ == "__main__":
    main()
