from ping3 import ping


def get_latency(host="8.8.8.8"):
    latency = ping(host, timeout=2)

    if latency is None:
        return None

    return round(latency * 1000, 2)


if __name__ == "__main__":
    latency = get_latency()

    print("NetGuard AI - Network Latency")
    print("-----------------------------")

    if latency is None:
        print("Ping failed or host is unreachable.")
    else:
        print(f"Target: 8.8.8.8")
        print(f"Latency: {latency} ms")