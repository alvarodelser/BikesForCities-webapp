import networkx as nx


def shortest_path(graph: nx.MultiDiGraph, start_node: int, end_node: int) -> list[int]:
    """Shortest path by physical distance (edge `length` attribute)."""
    return nx.shortest_path(graph, start_node, end_node, weight='length')


def safe_path(graph: nx.MultiDiGraph, start_node: int, end_node: int) -> list[int]:
    """Safest cycling path using `route_cost` as edge weight.

    route_cost = length * (1 + peligrosidad * length / 7200)
    so edges on cycleways/bike-infra roads are cheaper than equally long
    busy roads. Graph must be built with build_safe_graph().
    """
    return nx.shortest_path(graph, start_node, end_node, weight='route_cost')
