import psutil


def get_network_metrics():
    network = psutil.net_io_counters()

    return {
        "bytes_sent": network.bytes_sent,
        "bytes_received": network.bytes_recv,
        "packets_sent": network.packets_sent,
        "packets_received": network.packets_recv,
        "errors_in": network.errin,
        "errors_out": network.errout,
        "drops_in": network.dropin,
        "drops_out": network.dropout
    }


if __name__ == "__main__":
    metrics = get_network_metrics()

    print("NetGuard AI - Network Metrics")
    print("-----------------------------")
    print(f"Bytes Sent: {metrics['bytes_sent']}")
    print(f"Bytes Received: {metrics['bytes_received']}")
    print(f"Packets Sent: {metrics['packets_sent']}")
    print(f"Packets Received: {metrics['packets_received']}")
    print(f"Errors In: {metrics['errors_in']}")
    print(f"Errors Out: {metrics['errors_out']}")
    print(f"Drops In: {metrics['drops_in']}")
    print(f"Drops Out: {metrics['drops_out']}")