import networkx as nx

def shortest_path(graph: nx.MultiDiGraph, start_node: int, end_node: int) -> list[int]:
    """
    Compute the shortest path between two nodes using edge length.

    Parameters:
    - graph: a directed, weighted NetworkX graph
    - start_node: ID of the origin node
    - end_node: ID of the destination node

    Returns:
    - List of node IDs in the route
    """
    return nx.shortest_path(graph, start_node, end_node, weight='length')
