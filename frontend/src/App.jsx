import { useEffect, useRef, useState, useCallback } from "react";

// ── role colours ───────────────────────────────────────────────────────────────
const ROLE_COLOR = {
    attacker: '#e24b4a',
    'pre-inter': '#ffb347',
    inter: '#7f77dd',
    thorchain: '#1d9e75',
};

const SPEEDS = [0.7, 0.8, 0.9];

// ── synthetic transactions (demo fallback) ─────────────────────────────────────
function buildSyntheticTxs() {
    const txs = [];
    const startMs = new Date('2025-04-17T08:00:00Z').getTime();
    const endMs = new Date('2025-04-25T20:00:00Z').getTime();
    const span = endMs - startMs;
    let rng = 42;
    const rand = () => { rng = (rng * 1664525 + 1013904223) & 0xffffffff; return (rng >>> 0) / 4294967296; };

    // Simple placeholder data if graph.json is missing
    for (let i = 0; i < 50; i++) {
        txs.push({
            from: `0xdemo_sender_${Math.floor(rand() * 10)}`,
            to: `0xdemo_receiver_${Math.floor(rand() * 10)}`,
            amount: 10 + rand() * 100,
            label: 'mutual_transfer',
            ts: startMs + rand() * span
        });
    }
    txs.sort((a, b) => a.ts - b.ts);
    return txs;
}

// ── helper ─────────────────────────────────────────────────────────────────────
function formatDate(ms) {
    const d = new Date(ms);
    const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()];
    return `${mon} ${String(d.getUTCDate()).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

const CopyIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
);

// ══════════════════════════════════════════════════════════════════════════════
// SIMULATION VIEW — exact port of the HTML canvas version
// ══════════════════════════════════════════════════════════════════════════════
export default function App() {
    const canvasRef = useRef(null);
    const rafRef = useRef(null);

    // All mutable sim state lives in one ref — no stale closures, no re-renders in the loop
    const S = useRef(null);

    // React state only for the HUD elements (updated each frame via setters)
    const [playing, setPlaying] = useState(false);
    const [speedIdx, setSpeedIdx] = useState(1);
    const [scrub, setScrub] = useState(0);
    const [timeLabel, setTimeLabel] = useState('');
    const [txCounter, setTxCounter] = useState('tx 0 / 0');
    const [stats, setStats] = useState({ nodes: 0, txns: 0, eth: '0', launder: '0' });
    const [info, setInfo] = useState(null);   // clicked node or tx details
    const [copied, setCopied] = useState(false);

    const [viewMode, setViewMode] = useState('fund'); // 'fund' or 'simulate'
    const vmRef = useRef('fund');
    useEffect(() => { vmRef.current = viewMode; }, [viewMode]);

    // ── build initial state object ──────────────────────────────────────────
    const makeState = useCallback((txs, roles) => ({
        allTxs: txs,
        roles: roles || {},
        startMs: txs[0].ts,
        endMs: txs[txs.length - 1].ts,
        span: (txs[txs.length - 1].ts - txs[0].ts) || 1,
        txCursor: 0,
        simTime: txs[0].ts,
        playing: false,
        speedIdx: 1,
        nodes: {},
        particles: [],
        edgeCounts: {},
        stacks: { attacker: [], 'pre-inter': [], inter: [], thorchain: [] },
        totalEth: 0,
        launderEth: 0,
        hoveredNode: null,
        hoveredParticle: null,
        draggingNode: null,
        hasDragged: false,
        selectedParticleId: null,
        rngNode: 99,
    }), []);

    // ── canvas + render loop ────────────────────────────────────────────────
    useEffect(() => {
        const txs = buildSyntheticTxs();

        // Try real data, fall back to synthetic
        const bootstrap = (finalTxs, finalRoles) => {
            S.current = makeState(finalTxs, finalRoles);
            // Pre-create attacker nodes so they are visible from the start
            Object.entries(finalRoles).forEach(([addr, role]) => {
                if (role === 'attacker') getOrCreateNode(S.current, addr, true);
            });
            setTimeLabel(formatDate(S.current.simTime));
        };

        fetch('/graph.json')
            .then(r => { if (!r.ok) throw new Error(); return r.json(); })
            .then(data => {
                const roles = {};
                if (data.nodes) {
                    data.nodes.forEach(n => {
                        roles[n.id.toLowerCase()] = n.role;
                    });
                }

                const txs = (data.edges || []).map(e => ({
                    from: e.from,
                    to: e.to,
                    amount: e.amount_eth,
                    ts: new Date(e.timestamp).getTime(),
                    label: e.label,
                    hash: e.tx_hash
                })).sort((a, b) => a.ts - b.ts);

                bootstrap(txs, roles);
            })
            .catch(() => bootstrap(buildSyntheticTxs(), {}));

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let W = 0, H = 0;

        function resize() {
            const r = window.devicePixelRatio || 1;
            W = canvas.offsetWidth;
            H = canvas.offsetHeight;
            canvas.width = W * r;
            canvas.height = H * r;
            ctx.scale(r, r);
        }
        resize();
        window.addEventListener('resize', resize);

        // ── helper: node positioning ──────────────────────────────────────────
        const getColX = (role) => {
            if (role === 'attacker') return 80;
            if (role === 'pre-inter') return W * 0.28;
            if (role === 'inter') return W * 0.65;
            if (role === 'thorchain') return W - 110;
            return W / 2;
        };

        const randNode = (s) => {
            s.rngNode = (s.rngNode * 1664525 + 1013904223) & 0xffffffff;
            return (s.rngNode >>> 0) / 4294967296;
        };

        function getOrCreateNode(s, addr, forceActivate = false, initialOpacity = 0) {
            const key = addr.toLowerCase();
            if (s.nodes[key]) {
                if (forceActivate) s.nodes[key].activated = true;
                return s.nodes[key];
            }

            const role = s.roles[key] || 'inter';
            const stack = s.stacks[role] || s.stacks['inter'];
            const idx = stack.length;

            const colX = getColX(role);
            let x = colX, y = (H / 2);

            if (role === 'inter') {
                // Scatter intermediaries in a circular cluster
                const minX = W * 0.38;
                const maxX = W * 0.88;
                const centerX = (minX + maxX) / 2;
                const radiusX = (maxX - minX) / 2;
                const radiusY = H * 0.42;

                const angle = randNode(s) * Math.PI * 2;
                const dist = Math.sqrt(randNode(s)); // uniform distribution
                x = centerX + Math.cos(angle) * dist * radiusX;
                y = (H / 2) + Math.sin(angle) * dist * radiusY;
            } else {
                // Spread other nodes vertically from center
                const spacing = role === 'thorchain' ? 85 : 42;
                const yOffset = (idx % 2 === 0 ? 1 : -1) * Math.ceil(idx / 2) * spacing;
                y = (H / 2) + yOffset + (role === 'attacker' ? 60 : 0);
            }

            const r = role === 'thorchain' ? 16 : 9;

            const node = {
                addr, role, x, y,
                r,
                opacity: initialOpacity,
                activated: forceActivate || role === 'attacker',
                txns: 0, sent: 0, rcv: 0, pulses: [],
            };
            s.nodes[key] = node;
            stack.push(addr);
            return node;
        }

        function fireTransaction(s, tx) {
            const sn = getOrCreateNode(s, tx.from, true); // Sender is always visible
            const tn = getOrCreateNode(s, tx.to, false);  // Receiver only visible after receiving (or if attacker)
            sn.txns++; sn.sent += tx.amount;
            tn.txns++; tn.rcv += tx.amount;
            s.totalEth += tx.amount;
            if (tx.label === 'thorchain_launder') s.launderEth += tx.amount;

            const edgeKey = [tx.from, tx.to].sort().join(':');
            s.edgeCounts[edgeKey] = (s.edgeCounts[edgeKey] || 0) + 1;
            const curvature = 30 + (s.edgeCounts[edgeKey] * 12) % 180;

            // Simulated duration for a particle to cross the screen.
            const SIM_DURATION = 36000000;

            s.particles.push({
                id: Math.random().toString(36).substr(2, 9),
                sn, tn,
                curvature,
                fromAddr: tx.from, toAddr: tx.to,
                hash: tx.hash,
                startTs: tx.ts,
                duration: SIM_DURATION,
                pw: Math.min(0.5 + tx.amount / 400, 3),
                amount: tx.amount,
                color: ROLE_COLOR[sn.role],
                targetNode: tn,
                pulsed: false,
            });
            tn.pulses.push({ age: 0, color: ROLE_COLOR[tn.role] });
        }

        function drawStaticEdge(ctx, sn, tn, curvature, color, amount, isSelected, isHovered) {
            const mx = (sn.x + tn.x) / 2, my = Math.min(sn.y, tn.y) - curvature;
            ctx.save();
            const isInter = color === ROLE_COLOR.inter || color === ROLE_COLOR['pre-inter'];
            ctx.globalAlpha = isSelected ? 0.6 : (isHovered ? 0.4 : (isInter ? 0.18 : 0.10));
            ctx.strokeStyle = (isSelected || isHovered) ? '#fff' : color;
            const pw = Math.min(0.5 + amount / 400, 3);
            ctx.lineWidth = (isSelected || isHovered) ? pw * 1.5 : pw * 0.6;
            ctx.beginPath(); ctx.moveTo(sn.x, sn.y); ctx.quadraticCurveTo(mx, my, tn.x, tn.y); ctx.stroke();

            if (isSelected && amount > 0.01) {
                ctx.globalAlpha = 1.0; ctx.font = 'bold 10px monospace';
                const txt = amount.toFixed(2) + ' ETH';
                const tw = ctx.measureText(txt).width;
                const tx_pos = (1 - 0.5) ** 2 * sn.x + 2 * (1 - 0.5) * 0.5 * mx + 0.5 ** 2 * tn.x;
                const ty_pos = (1 - 0.5) ** 2 * sn.y + 2 * (1 - 0.5) * 0.5 * my + 0.5 ** 2 * tn.y - 10;
                ctx.fillStyle = 'rgba(10,10,20,0.85)';
                ctx.fillRect(tx_pos - tw / 2 - 5, ty_pos - 10, tw + 10, 14);
                ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.strokeRect(tx_pos - tw / 2 - 5, ty_pos - 10, tw + 10, 14);
                ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(txt, tx_pos, ty_pos);
            }
            ctx.restore();
        }

        let lastT = null;

        function frame(now) {
            if (!lastT) lastT = now;
            const dtMs = now - lastT;
            lastT = now;
            const dt = dtMs / 1000;

            const s = S.current;
            if (!s) { rafRef.current = requestAnimationFrame(frame); return; }

            const speed = SPEEDS[s.speedIdx];

            if (s.playing) {
                s.simTime += dtMs * speed * 40000;
                if (s.simTime > s.endMs) {
                    s.simTime = s.endMs;
                    s.playing = false;
                    setPlaying(false);
                }
                while (s.txCursor < s.allTxs.length && s.allTxs[s.txCursor].ts <= s.simTime) {
                    fireTransaction(s, s.allTxs[s.txCursor++]);
                }
            }

            // ── draw ──
            ctx.clearRect(0, 0, W, H);
            ctx.fillStyle = '#0a0a0f';
            ctx.fillRect(0, 0, W, H);

            // column guides
            ['attacker', 'pre-inter', 'inter', 'thorchain'].forEach(role => {
                const x = getColX(role);
                ctx.save();
                ctx.strokeStyle = ROLE_COLOR[role]; ctx.globalAlpha = 0.04;
                ctx.lineWidth = 1; ctx.setLineDash([4, 8]);
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
                ctx.restore();
            });

            // ── particles / flow ──
            if (vmRef.current === 'fund') {
                // Ensure all nodes and fund particles are ready
                if (!s.fundParticles) {
                    s.fundParticles = s.allTxs.map((tx, idx) => {
                        const sn = getOrCreateNode(s, tx.from);
                        const tn = getOrCreateNode(s, tx.to);
                        const curvature = 30 + ((idx * 17) % 150);
                        return {
                            id: `fund_${idx}`,
                            sn, tn, curvature, fromAddr: tx.from, toAddr: tx.to, hash: tx.hash, amount: tx.amount,
                            color: ROLE_COLOR[sn.role] || '#fff',
                            pw: Math.min(0.5 + tx.amount / 400, 3),
                            prog: 1
                        };
                    });
                }
                s.fundParticles.forEach(p => {
                    const isSelected = s.selectedParticleId === p.id;
                    const isHovered = s.hoveredParticle === p;
                    drawStaticEdge(ctx, p.sn, p.tn, p.curvature, p.color, p.amount, isSelected, isHovered);
                });
            } else {
                s.particles.forEach(p => {
                    p.prog = (s.simTime - p.startTs) / p.duration;
                    if (p.prog >= 1) {
                        p.prog = 1;
                        if (!p.pulsed) {
                            p.pulsed = true;
                            p.targetNode.pulses.push({ age: 0, color: p.color });
                            p.targetNode.activated = true; // Activate on first receipt
                        }
                    }
                    if (p.prog < 0) return;

                    const et = p.prog < 0.5 ? 4 * p.prog ** 3 : 1 - Math.pow(-2 * p.prog + 2, 3) / 2;
                    const mx = (p.sn.x + p.tn.x) / 2, my = Math.min(p.sn.y, p.tn.y) - p.curvature;
                    const bx = (1 - et) ** 2 * p.sn.x + 2 * (1 - et) * et * mx + et ** 2 * p.tn.x;
                    const by = (1 - et) ** 2 * p.sn.y + 2 * (1 - et) * et * my + et ** 2 * p.tn.y;

                    ctx.save();
                    const isSelected = s.selectedParticleId === p.id;
                    const isHovered = s.hoveredParticle === p;

                    const isInter = p.color === ROLE_COLOR.inter || p.color === ROLE_COLOR['pre-inter'];
                    ctx.globalAlpha = p.prog >= 1 ? (isSelected ? 0.6 : (isInter ? 0.20 : 0.12)) : (0.18 + (1 - p.prog) * 0.2);

                    ctx.strokeStyle = (isSelected || isHovered) ? '#fff' : p.color;
                    ctx.lineWidth = (isSelected || isHovered) ? p.pw * 1.5 : p.pw * 0.6;
                    ctx.beginPath(); ctx.moveTo(p.sn.x, p.sn.y); ctx.quadraticCurveTo(mx, my, bx, by); ctx.stroke();

                    if (isSelected && p.amount > 0.01) {
                        ctx.save();
                        ctx.globalAlpha = 1.0; ctx.font = 'bold 10px monospace';
                        const txt = p.amount.toFixed(2) + ' ETH';
                        const tw = ctx.measureText(txt).width;
                        const tx_pos = (1 - 0.5) ** 2 * p.sn.x + 2 * (1 - 0.5) * 0.5 * mx + 0.5 ** 2 * p.tn.x;
                        const ty_pos = (1 - 0.5) ** 2 * p.sn.y + 2 * (1 - 0.5) * 0.5 * my + 0.5 ** 2 * p.tn.y - 10;
                        ctx.fillStyle = 'rgba(10,10,20,0.85)';
                        ctx.fillRect(tx_pos - tw / 2 - 5, ty_pos - 10, tw + 10, 14);
                        ctx.strokeStyle = p.color; ctx.lineWidth = 1; ctx.strokeRect(tx_pos - tw / 2 - 5, ty_pos - 10, tw + 10, 14);
                        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(txt, tx_pos, ty_pos);
                        ctx.restore();
                    }

                    if (p.prog < 1) {
                        ctx.globalAlpha = 0.9; ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 8;
                        ctx.beginPath(); ctx.arc(bx, by, p.pw + 2, 0, Math.PI * 2); ctx.fill();
                    }
                    ctx.restore();
                });
            }

            // nodes
            Object.values(s.nodes).forEach(n => {
                const isVisible = vmRef.current === 'fund' || n.activated;
                if (!isVisible) {
                    n.opacity = 0;
                    return;
                }

                n.opacity = Math.min(1, n.opacity + dt * 2.5);
                n.pulses = n.pulses.filter(p => p.age < 1);
                n.pulses.forEach(p => {
                    p.age += dt * 1.2;
                    ctx.save();
                    ctx.globalAlpha = (1 - p.age) * 0.5 * n.opacity; ctx.strokeStyle = p.color; ctx.lineWidth = 1.5;
                    ctx.beginPath(); ctx.arc(n.x, n.y, n.r + p.age * 26, 0, Math.PI * 2); ctx.stroke();
                    ctx.restore();
                });
                const color = ROLE_COLOR[n.role];
                ctx.save();
                ctx.globalAlpha = n.opacity;
                ctx.shadowColor = color; ctx.shadowBlur = s.hoveredNode === n ? 20 : 10;
                ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
                ctx.fillStyle = color + '33'; ctx.fill();
                ctx.strokeStyle = color; ctx.lineWidth = s.hoveredNode === n ? 2 : 1; ctx.stroke();
                ctx.shadowBlur = 0;
                ctx.fillStyle = color; ctx.font = '8px monospace'; ctx.textAlign = 'center';
                ctx.fillText(n.addr.slice(0, 8) + '…', n.x, n.y + n.r + 10);
                ctx.restore();
            });

            // HUD state
            if (vmRef.current === 'fund') {
                if (!s.totalStats) {
                    const eth = s.allTxs.reduce((a, b) => a + b.amount, 0);
                    const lnd = s.allTxs.filter(t => t.label === 'thorchain_launder').reduce((a, b) => a + b.amount, 0);
                    s.totalStats = { eth: Math.round(eth).toLocaleString(), launder: Math.round(lnd).toLocaleString() };
                }
                setScrub(1000);
                setTimeLabel(formatDate(s.endMs));
                setTxCounter(`tx ${s.allTxs.length} / ${s.allTxs.length}`);
                setStats({
                    nodes: Object.keys(s.nodes).length,
                    txns: s.allTxs.length,
                    eth: s.totalStats.eth,
                    launder: s.totalStats.launder,
                });
            } else {
                const pct = (s.simTime - s.startMs) / s.span;
                setScrub(Math.round(pct * 1000));
                setTimeLabel(formatDate(s.simTime));
                setTxCounter(`tx ${s.txCursor} / ${s.allTxs.length}`);
                setStats({
                    nodes: Object.keys(s.nodes).length,
                    txns: s.txCursor,
                    eth: Math.round(s.totalEth).toLocaleString(),
                    launder: Math.round(s.launderEth).toLocaleString(),
                });
            }

            rafRef.current = requestAnimationFrame(frame);
        }

        rafRef.current = requestAnimationFrame(frame);

        // helper: hit detection for curves
        function getHitParticle(mx, my) {
            if (!S.current) return null;
            const list = vmRef.current === 'fund' ? S.current.fundParticles : S.current.particles;
            if (!list) return null;
            for (let i = list.length - 1; i >= 0; i--) {
                const p = list[i];
                if (p.prog < 0) continue;
                const midX = (p.sn.x + p.tn.x) / 2, midY = Math.min(p.sn.y, p.tn.y) - p.curvature;
                for (let t = 0; t <= 1; t += 0.05) {
                    const bx = (1 - t) ** 2 * p.sn.x + 2 * (1 - t) * t * midX + t ** 2 * p.tn.x;
                    const by = (1 - t) ** 2 * p.sn.y + 2 * (1 - t) * t * midY + t ** 2 * p.tn.y;
                    if (Math.sqrt((bx - mx) ** 2 + (by - my) ** 2) < 10) return p;
                }
            }
            return null;
        }

        // mouse events
        function onMouseMove(e) {
            if (!S.current) return;
            const rect = canvas.getBoundingClientRect();
            const mx = (e.clientX - rect.left), my = (e.clientY - rect.top);
            if (S.current.draggingNode) {
                S.current.draggingNode.x = mx; S.current.draggingNode.y = my;
                S.current.hasDragged = true; return;
            }
            const isVisible = (n) => vmRef.current === 'fund' || n.activated;
            S.current.hoveredNode = Object.values(S.current.nodes)
                .filter(isVisible)
                .find(n => Math.sqrt((n.x - mx) ** 2 + (n.y - my) ** 2) <= n.r + 15) || null;
            S.current.hoveredParticle = S.current.hoveredNode ? null : getHitParticle(mx, my);
            canvas.style.cursor = (S.current.hoveredNode || S.current.hoveredParticle) ? 'pointer' : 'default';
        }

        function onMouseDown(e) {
            if (!S.current) return;
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left, my = e.clientY - rect.top;
            const isVisible = (n) => vmRef.current === 'fund' || n.activated;
            const hit = Object.values(S.current.nodes)
                .filter(isVisible)
                .find(n => Math.sqrt((n.x - mx) ** 2 + (n.y - my) ** 2) <= n.r + 15);
            if (hit) { S.current.draggingNode = hit; S.current.hasDragged = false; }
        }

        function onMouseUp(e) {
            if (!S.current) return;

            // If we clicked a button or something inside the info panel, don't trigger canvas click logic
            if (e.target.closest('button') || e.target.closest('.info-panel')) {
                S.current.draggingNode = null;
                return;
            }

            if (S.current.draggingNode) {
                const node = S.current.draggingNode; const dragged = S.current.hasDragged; S.current.draggingNode = null;
                if (!dragged) {
                    setInfo({ type: 'node', addr: node.addr, role: node.role, txns: node.txns, sent: Math.round(node.sent), rcv: Math.round(node.rcv) });
                    S.current.selectedParticleId = null; setCopied(false);
                }
                return;
            }
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left, my = e.clientY - rect.top;
            const partHit = getHitParticle(mx, my);
            if (partHit) {
                setInfo({ type: 'tx', from: partHit.fromAddr, to: partHit.toAddr, amount: partHit.amount, hash: partHit.hash });
                S.current.selectedParticleId = partHit.id; setCopied(false);
            } else { setInfo(null); S.current.selectedParticleId = null; }
        }

        window.addEventListener('mousemove', onMouseMove);
        canvas.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mouseup', onMouseUp);

        return () => {
            cancelAnimationFrame(rafRef.current); window.removeEventListener('resize', resize);
            window.removeEventListener('mousemove', onMouseMove); canvas.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [makeState]);

    // ── control handlers ────────────────────────────────────────────────────
    function handlePlay() {
        const s = S.current; if (!s) return;
        if (!s.playing && s.simTime >= s.endMs) {
            const fresh = makeState(s.allTxs, s.roles); fresh.speedIdx = s.speedIdx; S.current = fresh; setInfo(null);
        }
        S.current.playing = !S.current.playing; setPlaying(S.current.playing);
    }

    function handleSpeed() {
        const next = (speedIdx + 1) % SPEEDS.length;
        setSpeedIdx(next); if (S.current) S.current.speedIdx = next;
    }

    function handleScrub(e) {
        const s = S.current; if (!s) return;
        const val = parseInt(e.target.value);
        const target = s.startMs + (val / 1000) * s.span;

        // Immediate UI feedback
        setScrub(val);
        setTimeLabel(formatDate(target));

        if (target < s.simTime) {
            const wasPlaying = s.playing;
            S.current = makeState(s.allTxs, s.roles);
            S.current.speedIdx = s.speedIdx;
            S.current.playing = wasPlaying;
            // Restore attackers immediately
            Object.entries(s.roles).forEach(([addr, role]) => {
                if (role === 'attacker') getOrCreateNode(S.current, addr, true, 1);
            });
            setInfo(null);
        }
        S.current.simTime = target;

        const SIM_DURATION = 36000000;
        while (S.current.txCursor < S.current.allTxs.length && S.current.allTxs[S.current.txCursor].ts <= target) {
            const tx = S.current.allTxs[S.current.txCursor++];
            const prog = (target - tx.ts) / SIM_DURATION;

            // When scrubbing, we want nodes to appear immediately if they've received funds
            const sn = getOrCreateNode(S.current, tx.from, true, 1);
            const tn = getOrCreateNode(S.current, tx.to, true, 1);

            sn.txns++; sn.sent += tx.amount; tn.txns++; tn.rcv += tx.amount;
            S.current.totalEth += tx.amount; if (tx.label === 'thorchain_launder') S.current.launderEth += tx.amount;

            const edgeKey = [tx.from, tx.to].sort().join(':');
            S.current.edgeCounts[edgeKey] = (S.current.edgeCounts[edgeKey] || 0) + 1;
            const curvature = 30 + (S.current.edgeCounts[edgeKey] * 12) % 180;

            S.current.particles.push({
                id: Math.random().toString(36).substr(2, 9),
                sn, tn, curvature, fromAddr: tx.from, toAddr: tx.to, hash: tx.hash, startTs: tx.ts, duration: SIM_DURATION,
                pw: Math.min(0.5 + tx.amount / 400, 3), amount: tx.amount, color: ROLE_COLOR[sn.role], targetNode: tn, pulsed: prog >= 1,
            });
        }
        setTxCounter(`tx ${S.current.txCursor} / ${S.current.allTxs.length}`);
    }

    function handleCopy(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }).catch(() => {
                // fallback if promise fails
                fallbackCopy(text);
            });
        } else {
            fallbackCopy(text);
        }
    }

    function fallbackCopy(text) {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand("copy");
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) { console.error("Fallback copy failed", err); }
        document.body.removeChild(ta);
    }

    // ── render ──────────────────────────────────────────────────────────────
    return (
        <div style={{ width: '100vw', height: '100vh', background: '#0a0a0f', display: 'flex', flexDirection: 'column', fontFamily: 'monospace', overflow: 'hidden', position: 'fixed', top: 0, left: 0 }}>
            <style>{`body, html { margin: 0; padding: 0; overflow: hidden; user-select: none; }`}</style>
            <canvas ref={canvasRef} style={{ flex: 1, display: 'block', width: '100%', minHeight: 0 }} />
            <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ color: '#fff', fontSize: 14, fontWeight: 700, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: '#e24b4a' }}>◈</span> KELP DAO EXPLOIT FUNDS FLOW
                    </div>
                    <div style={{ color: '#444470', fontSize: 9, fontWeight: 600, letterSpacing: '0.02em' }}>NETWORK ASSET FLOW ANALYSIS</div>
                </div>

                <div style={{ display: 'flex', background: 'rgba(20,20,35,0.85)', border: '1px solid #2e2e5e', borderRadius: 6, padding: 3, width: 'fit-content', backdropFilter: 'blur(4px)' }}>
                    <button
                        onClick={() => setViewMode('fund')}
                        style={{
                            background: viewMode === 'fund' ? '#3e3e7e' : 'transparent',
                            color: viewMode === 'fund' ? '#fff' : '#7070a0',
                            border: 'none', borderRadius: 4, padding: '6px 16px', fontSize: 10, cursor: 'pointer', transition: 'all 0.2s', fontWeight: 600, letterSpacing: '0.05em'
                        }}
                    >FUND FLOW</button>
                    <button
                        onClick={() => {
                            setViewMode('simulate');
                            if (S.current && !S.current.playing) handlePlay();
                        }}
                        style={{
                            background: viewMode === 'simulate' ? '#3e3e7e' : 'transparent',
                            color: viewMode === 'simulate' ? '#fff' : '#7070a0',
                            border: 'none', borderRadius: 4, padding: '6px 16px', fontSize: 10, cursor: 'pointer', transition: 'all 0.2s', fontWeight: 600, letterSpacing: '0.05em'
                        }}
                    >SIMULATE FLOW</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[['attacker', 'Attacker Entry'], ['pre-inter', 'Hop Address'], ['inter', 'Intermediate Node'], ['thorchain', 'Bridge Exit']].map(([role, label]) => (
                        <span key={role} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: '#7070a0', fontWeight: 500 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: ROLE_COLOR[role], flexShrink: 0, boxShadow: `0 0 8px ${ROLE_COLOR[role]}` }} />
                            {label.toUpperCase()}
                        </span>
                    ))}
                </div>
            </div>
            {info && (
                <div className="info-panel" style={{ position: 'absolute', bottom: 60, right: 12, background: 'rgba(10,10,20,.92)', border: '1px solid #2e2e5e', borderRadius: 8, padding: '10px 14px', fontSize: 10, color: '#7070a0', maxWidth: 260, zIndex: 100 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ color: info.type === 'node' ? ROLE_COLOR[info.role] : '#fff', fontWeight: 600 }}>
                            {info.type === 'node' ? (
                                info.role === 'thorchain' ? 'ATTACKER EXIT VIA THORCHAIN BRIDGE' :
                                    (info.role === 'inter' || info.role === 'pre-inter') ? 'LAUNDERING ADDRESS' :
                                        info.role.toUpperCase()
                            ) : 'TRANSACTION'}
                        </span>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            {copied && <span style={{ fontSize: 8, color: '#1d9e75' }}>COPIED!</span>}
                            <button onClick={() => setInfo(null)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</button>
                        </div>
                    </div>
                    {info.type === 'node' ? (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#9090cc', wordBreak: 'break-all', flex: 1 }}>{info.addr}</div>
                                <button onClick={() => handleCopy(info.addr)} style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', padding: 2, display: 'flex' }} title="Copy address">
                                    <CopyIcon />
                                </button>
                            </div>
                            {[['Txns', info.txns], ['Sent', info.sent + ' ETH'], ['Received', info.rcv + ' ETH']].map(([k, v]) => (
                                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 3 }}>
                                    <span>{k}</span><span style={{ color: '#a0a0d0' }}>{v}</span>
                                </div>
                            ))}
                        </>
                    ) : (
                        <>
                            <div style={{ marginBottom: 8 }}>
                                <div style={{ fontSize: 8, color: '#555', marginBottom: 2 }}>FROM</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <div style={{ fontSize: 9, color: '#9090cc', wordBreak: 'break-all', flex: 1 }}>{info.from}</div>
                                    <button onClick={() => handleCopy(info.from)} style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', padding: 2 }} title="Copy sender">
                                        <CopyIcon />
                                    </button>
                                </div>
                            </div>
                            <div style={{ marginBottom: 8 }}>
                                <div style={{ fontSize: 8, color: '#555', marginBottom: 2 }}>TO</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <div style={{ fontSize: 9, color: '#9090cc', wordBreak: 'break-all', flex: 1 }}>{info.to}</div>
                                    <button onClick={() => handleCopy(info.to)} style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', padding: 2 }} title="Copy receiver">
                                        <CopyIcon />
                                    </button>
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, borderTop: '1px solid #222', paddingTop: 6 }}>
                                <span style={{ color: '#fff', fontWeight: 600 }}>{info.amount.toFixed(4)} ETH</span>
                            </div>
                            {info.hash && (
                                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <div style={{ fontSize: 8, color: '#444', wordBreak: 'break-all', flex: 1 }}>{info.hash}</div>
                                    <button onClick={() => handleCopy(info.hash)} style={{ background: 'none', border: 'none', color: '#333', cursor: 'pointer', padding: 2 }} title="Copy hash">
                                        <CopyIcon />
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
            {viewMode === 'simulate' && (
                <div style={{ background: '#111118', borderTop: '1px solid #1e1e2e', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    <button onClick={handlePlay} style={{ background: '#1e1e2e', border: '1px solid #2e2e4e', color: '#a0a0c0', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 11, fontFamily: 'monospace' }}> {playing ? '⏸' : '▶'} </button>
                    <button onClick={handleSpeed} style={{ background: '#1e1e2e', border: '1px solid #2e2e4e', color: '#a0a0c0', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 10, fontFamily: 'monospace' }}> {SPEEDS[speedIdx]}× </button>
                    <input type="range" min="0" max="1000" value={scrub} onChange={handleScrub} style={{ flex: 1, accentColor: '#5555cc', cursor: 'pointer', height: 4 }} />
                    <span style={{ color: '#3a3a6a', fontSize: 10, minWidth: 60 }}>{txCounter}</span>
                    <span style={{ color: '#5555aa', fontSize: 10, minWidth: 80, textAlign: 'right' }}>{timeLabel}</span>
                </div>
            )}
        </div>
    );
}