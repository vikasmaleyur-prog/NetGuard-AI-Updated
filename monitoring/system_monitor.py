import psutil


def get_system_metrics():
    cpu_usage = psutil.cpu_percent(interval=1)
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage("/")

    load_1m, load_5m, load_15m = 0.0, 0.0, 0.0
    if hasattr(psutil, "getloadavg"):
        try:
            lavg = psutil.getloadavg()
            load_1m = round(lavg[0], 2)
            load_5m = round(lavg[1], 2)
            load_15m = round(lavg[2], 2)
        except Exception:
            pass

    return {
        "cpu_usage_percent": cpu_usage,
        "cpu_count": psutil.cpu_count(logical=True) or 1,
        "memory_usage_percent": memory.percent,
        "memory_total_gb": round(memory.total / (1024**3), 2),
        "memory_used_gb": round(memory.used / (1024**3), 2),
        "memory_available_gb": round(memory.available / (1024**3), 2),
        "disk_usage_percent": disk.percent,
        "disk_total_gb": round(disk.total / (1024**3), 1),
        "disk_used_gb": round(disk.used / (1024**3), 1),
        "disk_free_gb": round(disk.free / (1024**3), 1),
        "load_avg_1m": load_1m,
        "load_avg_5m": load_5m,
        "load_avg_15m": load_15m,
        "boot_time": psutil.boot_time(),
    }


if __name__ == "__main__":
    metrics = get_system_metrics()

    print("NetGuard AI - System Metrics")
    print("----------------------------")
    print(f"CPU Usage: {metrics['cpu_usage_percent']}%")
    print(f"Memory Usage: {metrics['memory_usage_percent']}%")
    print(f"Disk Usage: {metrics['disk_usage_percent']}%")