import pandas as pd
import json


ATTACKERS = {
    # '0x5d3919f12bcc35c26eee5f8226a9bee90c257ccc',
    '0xbb6a6006eb71205e977eceb19fcad1c8d631c787',
    '0x1f4c1c2e610f089d6914c4448e6f21cb0db3adef',
    '0xeba786c9517a4823a5cfd9c72e4e80bf8168129b',
    '0xcbb24a6b4dafaaa1a759a2f413ea0eb6ae1455cc',
    '0x8d11aeac74267dd5c56d371bf4ae1afa174c2d49',
}

THORCHAIN = {
    '0x9fc30541611132c5ac38318e8eee044d2d36996f',
    '0x4feea1caeea66b3351ddba68bd80c37c9ed6c3c8',
    '0x57bb04f3215dbbb60b9da6154e0a7abdb6fbac27',
    '0xd37bbe5744d730a1d98d8dc97c42f0ca46ad7146' # just added
}

def classify(wallet: str) -> str:
    w = wallet.lower()
    if w in ATTACKERS:
        return "attacker"
    elif w in THORCHAIN:
        return "thorchain"
    elif w == '0x5d3919f12bcc35c26eee5f8226a9bee90c257ccc':
        return 'pre-inter'
    return "inter"          # received from attacker, forwarded onward


df = pd.read_parquet("attackers_action")
df["amount"]     = df["amount"].astype(float)
df["amount_usd"] = df["amount_usd"].astype(float)


all_wallets = pd.concat([df["from_address"], df["to_address"]]).unique()

nodes = []
for wallet in all_wallets:
    nodes.append({
        "id":             wallet,
        "short":          wallet[:6] + "....." + wallet[-4:],
        "role":           classify(wallet),
        "total_sent":     round(float(df[df["from_address"] == wallet]["amount"].sum()), 4),
        "total_received": round(float(df[df["to_address"]   == wallet]["amount"].sum()), 4),
        "tx_count":       int((df["from_address"] == wallet).sum() +
                              (df["to_address"]   == wallet).sum()),
    })

edges = []
for _, row in df.iterrows():
    edges.append({
        "from":       row["from_address"],
        "to":         row["to_address"],
        "tx_hash":    row["tx_hash"],
        "amount_eth": round(row["amount"], 4),
        "amount_usd": round(row["amount_usd"], 2),
        "timestamp":  row["block_time"],
        "label":      row["label"],
    })

graph = {"nodes": nodes, "edges": edges}

with open("graph.json", "w") as f:
    json.dump(graph, f, indent=2)

from collections import Counter
roles = Counter(n["role"] for n in nodes)
print(f"Done: {len(nodes)} wallets → attacker:{roles['attacker']} pre-inter:{roles['pre-inter']}  inter:{roles['inter']}  thorchain:{roles['thorchain']}")
print(f"      {len(edges)} transactions → graph.json")