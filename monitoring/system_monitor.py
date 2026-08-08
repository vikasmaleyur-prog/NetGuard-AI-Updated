import psutil


def get_system_metrics():
    cpu_usage = psutil.cpu_percent(interval=1)
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage("/")

    return {
        "cpu_usage_percent": cpu_usage,
        "memory_usage_percent": memory.percent,
        "disk_usage_percent": disk.percent
    }


if __name__ == "__main__":
    metrics = get_system_metrics()

    print("NetGuard AI - System Metrics")
    print("----------------------------")
    print(f"CPU Usage: {metrics['cpu_usage_percent']}%")
    print(f"Memory Usage: {metrics['memory_usage_percent']}%")
    print(f"Disk Usage: {metrics['disk_usage_percent']}%")