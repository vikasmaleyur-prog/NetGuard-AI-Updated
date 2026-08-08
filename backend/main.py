from fastapi import FastAPI

app = FastAPI(
    title="NetGuard AI",
    description="Intelligent Network Monitoring and Self-Healing System",
    version="1.0.0"
)


@app.get("/")
def root():
    return {
        "project": "NetGuard AI",
        "status": "running",
        "message": "NetGuard AI backend is working!"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }