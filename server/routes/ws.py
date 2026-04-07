from fastapi import WebSocket
from websocket.manager import ConnectionManager

manager = ConnectionManager()


async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)

    try:
        # Send current auction state on connect
        await websocket.send_json({
            "event": "connected",
            "data": "Welcome to auction system"
        })

        while True:
            # Keep alive - receive messages
            data = await websocket.receive_text()
            # You can add message handling here if needed

    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        manager.disconnect(websocket)