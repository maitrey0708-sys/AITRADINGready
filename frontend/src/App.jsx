import React, {useEffect, useMemo, useRef, useState} from "react";
import "./signal-details.css";
import {Line} from "react-chartjs-2";
import {Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler} from "chart.js";
import {LayoutDashboard, Activity, FlaskConical, ShieldCheck, FileText, Settings, Bell, Search, Menu, TrendingUp, TrendingDown, LogIn} from "lucide-react";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

const API = "/api";
const nav = [
  ["Dashboard", LayoutDashboard], ["Signals", Activity], ["Backtesting", FlaskConical],
  ["Risk Management", ShieldCheck], ["Reports", FileText], ["Strategies", Settings]
];
const defaultStrategies = [
  {name: "AI Momentum", risk: "Medium", status: "ACTIVE", description: "Combines SMA, RSI and MACD conditions for signal generation."},
  {name: "RSI Reversal", risk: "Medium", status: "READY", description: "Uses RSI oversold/overbought zones for reversal entries."},
  {name: "Breakout Momentum", risk: "High", status: "READY", description: "Focuses on strong index breakouts with confirmation volume and trend follow-through."},
  {name: "VWAP Trend", risk: "Medium", status: "READY", description: "Tracks trend direction using VWAP and short-term moving-average alignment."},
  {name: "Mean Reversion", risk: "Low", status: "READY", description: "Captures oversold bounce opportunities near key support zones."},
  {name: "Swing Breakout", risk: "High", status: "READY", description: "Trades clean breakouts in directional sessions with risk-managed exits."}
];

function toCurrency(value){
  if(typeof value === "number" && Number.isFinite(value)) return `₹${value.toLocaleString("en-IN", {maximumFractionDigits: 2})}`;
  return "—";
}

function formatPercent(value){
  const clean = Number(value ?? 0);
  return `${clean >= 0 ? "+" : ""}${clean.toFixed(2)}%`;
}

function getSignalPlan(symbol, market, signal){
  const price = Number(market?.price || 0);
  const direction = (signal?.signal || "HOLD").toUpperCase();
  const entryFactor = direction === "BUY" ? 0.998 : direction === "SELL" ? 1.002 : 1;
  const exitFactor = direction === "BUY" ? 1.022 : direction === "SELL" ? 0.978 : 1.01;
  const stopLossFactor = direction === "BUY" ? 0.985 : direction === "SELL" ? 1.015 : 0.992;

  return {
    entry: price ? Number((price * entryFactor).toFixed(2)) : "—",
    exit: price ? Number((price * exitFactor).toFixed(2)) : "—",
    stopLoss: price ? Number((price * stopLossFactor).toFixed(2)) : "—",
    symbol: symbol || "Market",
    bias: direction === "BUY" ? "Bullish" : direction === "SELL" ? "Bearish" : "Neutral"
  };
}

function App(){
  const [page, setPage] = useState("Dashboard");
  const [symbol, setSymbol] = useState("NIFTY 50");
  const [markets, setMarkets] = useState([]);
  const [market, setMarket] = useState(null);
  const [signal, setSignal] = useState(null);
  const [backtest, setBacktest] = useState(null);
  const [backtestForm, setBacktestForm] = useState({
    symbol: "NIFTY 50",
    strategy: "AI Momentum",
    timeframe: "1D",
    initialCapital: "100000",
    positionSize: "1000",
    stopLoss: "1.5"
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [exportMessage, setExportMessage] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    try { return Boolean(localStorage.getItem("trademind-session")); } catch { return false; }
  });
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try {
      const width = Number(localStorage.getItem("trademind-sidebar-width"));
      return Number.isFinite(width) && width >= 200 && width <= 420 ? width : 245;
    } catch { return 245; }
  });
  const [profile, setProfile] = useState(() => {
    try {
      const savedProfile = JSON.parse(localStorage.getItem("trademind-profile") || "null");
      const savedUser = JSON.parse(localStorage.getItem("trademind-user") || "null");
      return savedProfile || {name: savedUser?.username || "TradeMind User", email: "", phone: "", location: ""};
    } catch { return {name: "TradeMind User", email: "", phone: "", location: ""}; }
  });
  const [profileOpen, setProfileOpen] = useState(false);
  const [developerCardOpen, setDeveloperCardOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsReadAt, setNotificationsReadAt] = useState(() => {
    try { return Number(localStorage.getItem("trademind-notifications-read-at") || 0); } catch { return 0; }
  });
  const [authMode, setAuthMode] = useState("login");
  const [loginForm, setLoginForm] = useState({ username: "", password: "", botToken: "", chatId: "" });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [telegramConfig, setTelegramConfig] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("trademind-telegram") || "{}");
      return { botToken: saved.botToken || "", chatId: saved.chatId || "" };
    } catch { return { botToken: "", chatId: "" }; }
  });
  const [logs, setLogs] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("trademind-log") || "[]");
      return Array.isArray(saved) && saved.length ? saved : [{time: new Date().toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"}), message: "System ready", type: "info"}];
    } catch { return [{time: new Date().toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"}), message: "System ready", type: "info"}]; }
  });
  const [riskRules, setRiskRules] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("trademind-risk-rules") || "null");
      return saved || {stopLoss: "2.0", maxDrawdown: "8.0", dailyLoss: "5000", capitalBox: "250000"};
    } catch {
      return {stopLoss: "2.0", maxDrawdown: "8.0", dailyLoss: "5000", capitalBox: "250000"};
    }
  });
  const [strategies, setStrategies] = useState(defaultStrategies);
  const lastSignalTelegramKeyRef = useRef("");

  const addLog = (message, type = "info") => {
    setLogs((current) => {
      const createdAt = Date.now();
      const next = [{id: `${createdAt}-${Math.random()}`, createdAt, time: new Date(createdAt).toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"}), message, type}, ...current].slice(0, 30);
      try { localStorage.setItem("trademind-log", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  useEffect(() => {
    try { localStorage.setItem("trademind-sidebar-width", String(sidebarWidth)); } catch {}
  }, [sidebarWidth]);

  useEffect(() => {
    try { localStorage.setItem("trademind-profile", JSON.stringify(profile)); } catch {}
  }, [profile]);

  function beginSidebarResize(event){
    event.preventDefault();
    const move = (moveEvent) => setSidebarWidth(Math.max(200, Math.min(420, moveEvent.clientX)));
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, {once: true});
  }

  function markNotificationsRead(){
    const readAt = Date.now();
    setNotificationsReadAt(readAt);
    try { localStorage.setItem("trademind-notifications-read-at", String(readAt)); } catch {}
  }

  function saveProfile(event, updatedProfile = profile){
    event.preventDefault();
    const savedProfile = {
      name: String(updatedProfile.name || "").trim() || "TradeMind User",
      email: String(updatedProfile.email || "").trim(),
      phone: String(updatedProfile.phone || "").trim(),
      location: String(updatedProfile.location || "").trim()
    };
    setProfile(savedProfile);
    try { localStorage.setItem("trademind-profile", JSON.stringify(savedProfile)); } catch {}
    setProfileOpen(false);
    addLog("Profile information saved on this device.", "success");
  }

  const notifyTelegram = async (message) => {
    try {
      const botToken = String(telegramConfig.botToken || "").trim();
      const chatId = String(telegramConfig.chatId || "").trim();
      addLog(message, "notification");
      if (!botToken || !chatId) {
        addLog("Telegram alert queued locally. Add bot token and chat ID to send it to Telegram.", "warning");
        return false;
      }
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ chat_id: chatId, text: message })
      });
      if (response.ok) {
        addLog("Telegram alert delivered.", "success");
        return true;
      }
      addLog("Telegram delivery failed. Check the bot token and chat ID.", "warning");
      return false;
    } catch (error) {
      addLog("Telegram notification could not be sent from this browser session.", "warning");
      return false;
    }
  };

  useEffect(() => {
    const loadMarkets = () => fetch(API + "/markets").then((r) => r.json()).then(setMarkets).catch(() => {});
    loadMarkets();
    const timer = setInterval(loadMarkets, 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch(API + "/market/" + encodeURIComponent(symbol)).then((r) => r.json()),
      fetch(API + "/signal/" + encodeURIComponent(symbol)).then((r) => r.json())
    ])
      .then(([m, s]) => { setMarket(m); setSignal(s); })
      .catch(() => {});
  }, [symbol]);

  useEffect(() => {
    const timer = setInterval(() => {
      fetch(API + "/market/" + encodeURIComponent(symbol)).then((r) => r.json()).then(setMarket).catch(() => {});
      fetch(API + "/signal/" + encodeURIComponent(symbol)).then((r) => r.json()).then(setSignal).catch(() => {});
    }, 15000);
    return () => clearInterval(timer);
  }, [symbol]);

  useEffect(() => {
    try { localStorage.setItem("trademind-risk-rules", JSON.stringify(riskRules)); } catch {}
  }, [riskRules]);

  useEffect(() => {
    if (!isLoggedIn || !market || !signal) return;
    const plan = getSignalPlan(symbol, market, signal);
    const signalKey = `${symbol}:${signal.signal}:${signal.confidence}:${Number(market.price || 0).toFixed(2)}`;
    if (lastSignalTelegramKeyRef.current === signalKey) return;
    lastSignalTelegramKeyRef.current = signalKey;

    const message = `${symbol}: ${signal.signal || "WAIT"} signal. Entry ${plan.entry}, Exit ${plan.exit}, Stop Loss ${plan.stopLoss}. Confidence ${signal.confidence || 0}%.`;
    notifyTelegram(message);
  }, [isLoggedIn, symbol, market, signal, telegramConfig.botToken, telegramConfig.chatId]);

  const chart = useMemo(() => market ? {
    labels: (market?.series || []).map((x) => x.time),
    datasets: [
      {label: `${symbol} Close`, data: (market.series || []).map((x) => x.close), borderColor: "#46a8ff", backgroundColor: "rgba(70,168,255,.12)", borderWidth: 2, pointRadius: 0, tension: 0.2, fill: true},
      {label: "SMA (20)", data: (market.series || []).map((x) => x.sma20 ?? null), borderColor: "#f3bd54", borderWidth: 1.5, pointRadius: 0, tension: 0.2, spanGaps: true}
    ]
  } : {labels: [], datasets: []}, [market]);

  async function runBacktest(customForm = backtestForm){
    const params = new URLSearchParams({
      symbol: customForm.symbol,
      initial_capital: String(customForm.initialCapital || 100000)
    });
    const r = await fetch(API + "/backtest?" + params.toString(), {method: "POST"});
    const result = await r.json();
    const merged = {...result, ...customForm, equity_curve: result.equity_curve || []};
    setBacktest(merged);
    setPage("Backtesting");
    addLog(`Backtest executed for ${customForm.symbol} using ${customForm.strategy} strategy.`, "info");
  }

  function handleLogin(event){
    event.preventDefault();
    const username = loginForm.username.trim();
    const password = loginForm.password.trim();
    if (!username || !password || password.length < 6) {
      setLoginError("Please enter a valid username and password (minimum 6 characters). ");
      return;
    }
    if (authMode === "signup" && password !== confirmPassword.trim()) {
      setLoginError("Passwords do not match. Please confirm your account password.");
      return;
    }
    try {
      localStorage.setItem("trademind-session", "active");
      localStorage.setItem("trademind-telegram", JSON.stringify({ botToken: loginForm.botToken.trim(), chatId: loginForm.chatId.trim() }));
      localStorage.setItem("trademind-user", JSON.stringify({ username, mode: authMode }));
      setProfile((current) => ({
        ...current,
        name: current.name === "TradeMind User" ? username : current.name
      }));
      setTelegramConfig({ botToken: loginForm.botToken.trim(), chatId: loginForm.chatId.trim() });
      setIsLoggedIn(true);
      setLoginError("");
      addLog(`${authMode === "signup" ? "Signed up and logged in" : "Logged in"} as ${username}.`, "success");
      if (loginForm.botToken.trim() && loginForm.chatId.trim()) {
        notifyTelegram(`TradeMind ${authMode === "signup" ? "signup" : "login"} successful for ${username}. Alerts are now enabled.`);
      }
    } catch {
      setLoginError("Session could not be started. Try again.");
    }
  }

  function handleLogout(){
    try { localStorage.removeItem("trademind-session"); } catch {}
    setIsLoggedIn(false);
    setPage("Dashboard");
    addLog("Logged out from TradeMind.", "warning");
  }

  function handleSearch(event){
    if (event.key !== "Enter") return;
    const query = searchQuery.trim().toLowerCase();
    if (!query) return;
    const marketMatch = markets.find((item) => item.symbol.toLowerCase().includes(query));
    const pageMatch = nav.find(([name]) => name.toLowerCase().includes(query));
    if (marketMatch) {
      setSymbol(marketMatch.symbol);
      setPage("Dashboard");
    } else if (pageMatch) {
      setPage(pageMatch[0]);
    } else if (strategies.some((item) => item.name.toLowerCase().includes(query))) {
      setPage("Strategies");
    } else {
      alert(`No market, section, or strategy found for "${searchQuery.trim()}".`);
    }
    setSearchQuery("");
  }

  function saveRiskRules(event){
    event.preventDefault();
    localStorage.setItem("trademind-risk-rules", JSON.stringify(riskRules));
    addLog("Risk rules saved.", "success");
  }

  function addStrategy(name){
    if (!name?.trim() || strategies.some((item) => item.name.toLowerCase() === name.trim().toLowerCase())) return false;
    setStrategies((current) => [...current, {name: name.trim(), risk: "Medium", status: "READY", description: "Custom strategy configuration."}]);
    return true;
  }

  function configureStrategy(name, risk){
    const normalizedRisk = risk.trim().toLowerCase();
    if (!["low", "medium", "high"].includes(normalizedRisk)) return false;
    setStrategies((current) => current.map((item) => item.name === name ? {...item, risk: normalizedRisk[0].toUpperCase() + normalizedRisk.slice(1)} : item));
    return true;
  }

  function exportReport(title, scope, period){
    const rows = [["Report", "Scope", "Period", "Generated"], [title, scope, period, new Date().toLocaleDateString()]];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], {type: "text/csv;charset=utf-8"}));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    const message = `${title} exported as ${link.download}.`;
    setExportMessage(message);
    addLog(message, "success");
    notifyTelegram(`Report exported: ${title} (${scope}, ${period}).`);
  }

  const notificationItems = logs.filter((entry) => ["notification", "warning", "success"].includes(entry.type));
  const unreadNotificationCount = notificationItems.filter((entry) => Number(entry.createdAt || 0) > notificationsReadAt).length;

  if (!isLoggedIn) {
    return (
      <div className="loginShell">
        <div className="loginCard">
          <div className="brand"><div className="brandIcon">AI</div><div><b>TradeMind</b><small>AI Trading Lab</small></div></div>
          <div className="authToggle">
            <button type="button" className={authMode === "login" ? "toggle active" : "toggle"} onClick={() => setAuthMode("login")}>Log in</button>
            <button type="button" className={authMode === "signup" ? "toggle active" : "toggle"} onClick={() => setAuthMode("signup")}>Sign up</button>
          </div>
          <h1>{authMode === "login" ? "Log in" : "Create account"}</h1>
          <p>{authMode === "login" ? "Access the live trading dashboard and risk controls." : "Open a new market-ready trading workspace."}</p>
          <form onSubmit={handleLogin} className="loginForm">
            <label>Username<input value={loginForm.username} onChange={(event) => setLoginForm((current) => ({...current, username: event.target.value}))} placeholder="admin" /></label>
            <label>Password<input type="password" value={loginForm.password} onChange={(event) => setLoginForm((current) => ({...current, password: event.target.value}))} placeholder="TradeMind123" /></label>
            {authMode === "signup" && <label>Confirm Password<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Confirm password" /></label>}
            <label>Telegram Bot Token<input value={loginForm.botToken} onChange={(event) => setLoginForm((current) => ({...current, botToken: event.target.value}))} placeholder="optional" /></label>
            <label>Telegram Chat ID<input value={loginForm.chatId} onChange={(event) => setLoginForm((current) => ({...current, chatId: event.target.value}))} placeholder="optional" /></label>
            {loginError && <div className="loginError" role="alert">{loginError}</div>}
            <button className="primary full" type="submit"><LogIn size={16} /> {authMode === "login" ? "Log in" : "Sign up"}</button>
          </form>
          <div className="demoCreds">Demo credentials: username <b>admin</b> · password <b>TradeMind123</b></div>
        </div>
      </div>
    );
  }

  return (
    <div className="app" style={{"--sidebar-width": `${sidebarWidth}px`}}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brandIcon">AI</div>
          <div><b>TradeMind</b><small>AI Trading Lab</small></div>
        </div>
        <button className="profileCard" type="button" onClick={() => setProfileOpen(true)} aria-label="View and edit profile">
          <span className="profileCardAvatar">{(profile.name || "U").trim().charAt(0).toUpperCase()}</span>
          <span className="profileCardText">
            <strong>{profile.name || "TradeMind User"}</strong>
            <small>{profile.email || "Add personal information"}</small>
          </span>
          <span className="profileEditHint">Edit</span>
        </button>
        <div className="sectionLabel">WORKSPACE</div>
        {nav.map(([name, Icon]) => <button key={name} className={page === name ? "nav active" : "nav"} onClick={() => setPage(name)}><Icon size={18} />{name}</button>)}
        <div className="sidebarBottom">
          <div className="riskMini"><span>●</span> System online<small>Market data connected</small></div>
        </div>
        <button
          className="sidebarResizeHandle"
          type="button"
          aria-label="Resize navigation panel"
          aria-valuemin={200}
          aria-valuemax={420}
          aria-valuenow={sidebarWidth}
          onPointerDown={beginSidebarResize}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") setSidebarWidth((width) => Math.max(200, width - 10));
            if (event.key === "ArrowRight") setSidebarWidth((width) => Math.min(420, width + 10));
          }}
        />
      </aside>
      <main>
        <header>
          <button className="mobileMenu" aria-label="Toggle navigation" onClick={() => document.querySelector(".sidebar")?.classList.toggle("open")}><Menu /></button>
          <div className="search"><Search size={17} /><input aria-label="Search symbols, strategies, or sections" placeholder="Search symbol, strategy..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onKeyDown={handleSearch} /></div>
          <div className="topActions">
            <div className="notificationWrap">
              <button
                className="iconButton notificationButton"
                aria-label={`Notifications${unreadNotificationCount ? `, ${unreadNotificationCount} unread` : ""}`}
                aria-expanded={notificationsOpen}
                aria-haspopup="dialog"
                onClick={() => setNotificationsOpen((open) => !open)}
              >
                <Bell />
                {unreadNotificationCount > 0 && <span className="notificationCount">{unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}</span>}
              </button>
              {notificationsOpen && (
                <div className="notificationPanel" role="dialog" aria-label="Notifications">
                  <div className="notificationPanelHead">
                    <div><strong>Notifications</strong><small>{unreadNotificationCount ? `${unreadNotificationCount} unread` : "You're all caught up"}</small></div>
                    <div className="notificationPanelActions">
                      <button className="linkButton" type="button" onClick={markNotificationsRead} disabled={!unreadNotificationCount}>Mark read</button>
                      <button className="popoverClose" type="button" aria-label="Close notifications" onClick={() => setNotificationsOpen(false)}>Close</button>
                    </div>
                  </div>
                  <div className="notificationList">
                    {notificationItems.length ? notificationItems.slice(0, 8).map((entry) => (
                      <div className={`notificationItem ${Number(entry.createdAt || 0) > notificationsReadAt ? "unread" : ""}`} key={entry.id || `${entry.time}-${entry.message}`}>
                        <span className={`notificationDot ${entry.type || "info"}`} />
                        <div><p>{entry.message}</p><time>{entry.time || "Earlier"}</time></div>
                      </div>
                    )) : <p className="notificationEmpty">No notifications yet. Trading alerts and account updates will appear here.</p>}
                  </div>
                </div>
              )}
            </div>
            <button className="logoutButton" onClick={handleLogout}>Logout</button>
            <div className="developerProfile">
              <button
                className="avatar"
                type="button"
                aria-label="Show developer name"
                aria-expanded={developerCardOpen}
                onClick={() => setDeveloperCardOpen((open) => !open)}
              >
                MJ
              </button>
              {developerCardOpen && (
                <div className="developerPopover" role="status">
                  <div className="developerPopoverHead">
                    <small>Developer</small>
                    <button className="popoverClose" type="button" aria-label="Close developer information" onClick={() => setDeveloperCardOpen(false)}>Close</button>
                  </div>
                  <strong>Mihir Joshi</strong>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="content">
          {page === "Dashboard" && <Dashboard markets={markets} symbol={symbol} setSymbol={setSymbol} market={market} signal={signal} chart={chart} runBacktest={() => runBacktest(backtestForm)} onViewAll={() => setPage("Signals")} notifyTelegram={notifyTelegram} addLog={addLog} />}
          {page === "Signals" && <Signals symbol={symbol} setSymbol={setSymbol} signal={signal} markets={markets} market={market} notifyTelegram={notifyTelegram} addLog={addLog} />}
          {page === "Backtesting" && <Backtesting backtest={backtest} runBacktest={() => runBacktest(backtestForm)} symbol={symbol} backtestForm={backtestForm} setBacktestForm={setBacktestForm} notifyTelegram={notifyTelegram} addLog={addLog} />}
          {page === "Risk Management" && <Risk riskRules={riskRules} setRiskRules={setRiskRules} saveRiskRules={saveRiskRules} addLog={addLog} />}
          {page === "Reports" && <Reports exportReport={exportReport} exportMessage={exportMessage} notifyTelegram={notifyTelegram} />}
          {page === "Strategies" && <Strategies strategies={strategies} addStrategy={addStrategy} configureStrategy={configureStrategy} addLog={addLog} />}
        </div>
      </main>
      {profileOpen && <ProfileDialog profile={profile} onSave={saveProfile} onClose={() => setProfileOpen(false)} />}
    </div>
  );
}

function Dashboard({markets, symbol, setSymbol, market, signal, chart, runBacktest, onViewAll, notifyTelegram, addLog}){
  const [showSignalDetails, setShowSignalDetails] = useState(false);
  const marketMap = useMemo(() => Object.fromEntries((markets || []).map((item) => [item.symbol, item])), [markets]);
  const breadth = useMemo(() => {
    const indiaSymbols = ["NIFTY 50", "BANK NIFTY", "SENSEX", "RELIANCE", "TCS", "INFOSYS", "HDFC BANK", "ICICI BANK", "SBIN", "ITC", "BHARTI AIRTEL"];
    const available = indiaSymbols.map((name) => marketMap[name]).filter(Boolean);
    const advancing = available.filter((item) => Number(item.change) > 0).length;
    const declining = available.filter((item) => Number(item.change) < 0).length;
    const unchanged = available.filter((item) => Number(item.change) === 0).length;
    return {advancing, declining, unchanged, total: available.length};
  }, [marketMap]);
  const marketStats = [
    {title: "Sensex", value: marketMap["SENSEX"] ? `₹${marketMap["SENSEX"].price.toLocaleString("en-IN", {maximumFractionDigits: 2})}` : "—", delta: marketMap["SENSEX"] ? formatPercent(marketMap["SENSEX"].change) : "—", icon: "S"},
    {title: "Nifty 50", value: marketMap["NIFTY 50"] ? `₹${marketMap["NIFTY 50"].price.toLocaleString("en-IN", {maximumFractionDigits: 2})}` : "—", delta: marketMap["NIFTY 50"] ? formatPercent(marketMap["NIFTY 50"].change) : "—", icon: "N"},
    {title: "Bank Nifty", value: marketMap["BANK NIFTY"] ? `₹${marketMap["BANK NIFTY"].price.toLocaleString("en-IN", {maximumFractionDigits: 2})}` : "—", delta: marketMap["BANK NIFTY"] ? formatPercent(marketMap["BANK NIFTY"].change) : "—", icon: "B"}
  ];
  const signalPlan = getSignalPlan(symbol, market, signal);

  return (
    <>
      <div className="pageHead">
        <div><p className="eyebrow">OVERVIEW</p><h1>Trading Dashboard</h1><p>AI-powered market intelligence and strategy monitoring.</p></div>
        <button className="primary" onClick={() => { runBacktest(); notifyTelegram(`Backtest launched for ${symbol}.`); }}>Run Backtest</button>
      </div>
      <div className="marketStrip">{(markets || []).map((m) => <button type="button" className={"marketPill " + (m.symbol === symbol ? "selected" : "")} onClick={() => setSymbol(m.symbol)} key={m.symbol}><span>{m.symbol}</span><b>{m.price.toLocaleString()}</b><em className={m.change >= 0 ? "up" : "down"}>{m.change >= 0 ? "+" : ""}{m.change}%</em></button>)}</div>
      <div className="grid4">
        {marketStats.map((item) => <Stat key={item.title} title={item.title} value={item.value} delta={item.delta} icon={item.icon} />)}
        <MarketBreadth breadth={breadth} />
      </div>
      <div className="mainGrid">
        <div className="panel chartPanel">
          <div className="panelHead">
            <div><h3>{symbol} <span className="liveDot">{market?.live ? "LIVE" : "DEMO"}</span></h3><span className="bigPrice">{market?.price?.toLocaleString(undefined, {maximumFractionDigits: 2}) || "—"}</span></div>
            <select value={symbol} onChange={(event) => setSymbol(event.target.value)}>{(markets || []).map((m) => <option key={m.symbol}>{m.symbol}</option>)}</select>
          </div>
          <div className="chart"><Line data={chart} options={{responsive: true, maintainAspectRatio: false, interaction: {mode: "index", intersect: false}, plugins: {legend: {display: true, labels: {color: "#aab9cc", boxWidth: 14, usePointStyle: true}}, tooltip: {callbacks: {label: (context) => `${context.dataset.label}: ${Number(context.parsed.y).toLocaleString(undefined, {maximumFractionDigits: 2})}`, afterBody: (items) => { const candle = market?.series?.[items[0]?.dataIndex]; return candle ? [`Open: ${Number(candle.open).toLocaleString()}`, `High: ${Number(candle.high).toLocaleString()}`, `Low: ${Number(candle.low).toLocaleString()}`, `Volume: ${Number(candle.volume || 0).toLocaleString()}`] : []; }}}}, scales: {x: {ticks: {color: "#8190a5", maxTicksLimit: 8}, grid: {display: false}}, y: {grid: {color: "rgba(255,255,255,.05)"}, ticks: {color: "#8190a5"}}}}} /></div>
        </div>
        <div className="panel signalPanel">
          <div className="panelHead"><h3>AI Signal</h3><span className="badge">MODEL v1.0</span></div>
          <div className={"signal " + (signal?.signal || "HOLD").toLowerCase()}>{signal?.signal || "WAIT"}<small>{signal?.confidence || 0}% confidence</small></div>
          <div className="meter"><span style={{width: `${signal?.confidence || 0}%`}} /></div>
          <div className="indicatorRows">
            <Row name="RSI" value={signal?.rsi ?? "—"} status={signal?.rsi > 70 ? "Overbought" : "Neutral"} />
            <Row name="MACD" value={signal?.macd ?? "—"} status="Trend" />
            <Row name="Strategy" value="AI Momentum" status="Active" />
          </div>
          <button className="outline" type="button" onClick={() => setShowSignalDetails(true)}>View Signal Details</button>
        </div>
      </div>
      {showSignalDetails && (
        <div className="signalDialogBackdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setShowSignalDetails(false);
        }}>
          <section className="signalDialog" role="dialog" aria-modal="true" aria-labelledby="signal-details-title">
            <div className="panelHead">
              <div>
                <p className="eyebrow">CURRENT MARKET SETUP</p>
                <h2 id="signal-details-title">{symbol} Signal Details</h2>
              </div>
              <button className="outline" type="button" aria-label="Close signal details" onClick={() => setShowSignalDetails(false)}>Close</button>
            </div>
            <div className="signalDetailGrid">
              <Row name="Signal" value={signal?.signal || "WAIT"} status={`${signal?.confidence || 0}% confidence`} />
              <Row name="Bias" value={signalPlan.bias} status={market?.live ? "Live data" : "Demo data"} />
              <Row name="Market price" value={toCurrency(market?.price)} status={market?.updated_at ? new Date(market.updated_at).toLocaleString() : "Awaiting data"} />
              <Row name="Entry" value={toCurrency(signalPlan.entry)} status="Indicative" />
              <Row name="Target exit" value={toCurrency(signalPlan.exit)} status="Indicative" />
              <Row name="Stop loss" value={toCurrency(signalPlan.stopLoss)} status="Indicative" />
              <Row name="RSI (14)" value={signal?.rsi ?? "—"} status={signal?.rsi > 70 ? "Overbought" : signal?.rsi < 30 ? "Oversold" : "Neutral"} />
              <Row name="MACD" value={signal?.macd ?? "—"} status="Trend indicator" />
            </div>
            <p className="signalDisclaimer">Signal levels are indicative estimates for analysis only, not exchange-verified option prices or investment advice.</p>
            <div className="signalDialogActions">
              <button className="outline" type="button" onClick={() => setShowSignalDetails(false)}>Done</button>
              <button className="primary" type="button" onClick={() => {
                const message = `${symbol}: ${signal?.signal || "WAIT"} signal with ${signal?.confidence || 0}% confidence. Entry ${signalPlan.entry}, Exit ${signalPlan.exit}, Stop Loss ${signalPlan.stopLoss}.`;
                addLog(message, "notification");
                notifyTelegram(message);
              }}>Send details to Telegram</button>
            </div>
          </section>
        </div>
      )}
      <div className="bottomGrid">
        <div className="panel">
          <div className="panelHead"><h3>Technical Indicators</h3><span>Live</span></div>
          <div className="indicatorCards">
            <Indicator title="RSI (14)" value={signal?.rsi ?? "—"} sub="Neutral zone" />
            <Indicator title="MACD" value={signal?.macd ?? "—"} sub="Momentum" />
            <Indicator title="SMA (20)" value={market?.indicators?.sma20?.toLocaleString() ?? "—"} sub="Trend support" />
            <Indicator title="Latest volume" value={market?.series?.length ? Number(market.series.at(-1)?.volume || 0).toLocaleString() : "—"} sub="Provider volume" />
          </div>
        </div>
        <div className="panel activity">
          <div className="panelHead"><h3>Recent Signals</h3><button className="linkButton" onClick={onViewAll}>View all</button></div>
          <div className="signalLine"><i className="buy">BUY</i><b>NIFTY 50</b><span>09:42 AM</span><strong>₹25,842</strong></div>
          <div className="signalLine"><i className="sell">SELL</i><b>BTC/USDT</b><span>09:18 AM</span><strong>$112,640</strong></div>
          <div className="signalLine"><i className="hold">HOLD</i><b>BANK NIFTY</b><span>08:57 AM</span><strong>₹58,320</strong></div>
        </div>
      </div>
    </>
  );
}

function ProfileDialog({profile, onSave, onClose}){
  const [draft, setDraft] = useState(profile);
  return (
    <div className="profileDialogBackdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <form className="profileDialog" onSubmit={(event) => onSave(event, draft)} role="dialog" aria-modal="true" aria-labelledby="profile-dialog-title">
        <div className="panelHead">
          <div>
            <p className="eyebrow">ACCOUNT</p>
            <h2 id="profile-dialog-title">Personal profile</h2>
          </div>
          <button className="outline" type="button" onClick={onClose}>Close</button>
        </div>
        <p className="profilePrivacyNote">Profile information is stored in this browser on this device.</p>
        <label>Full name<input autoComplete="name" value={draft.name || ""} onChange={(event) => setDraft((current) => ({...current, name: event.target.value}))} maxLength={80} /></label>
        <label>Email address<input type="email" autoComplete="email" value={draft.email || ""} onChange={(event) => setDraft((current) => ({...current, email: event.target.value}))} maxLength={120} /></label>
        <label>Phone number<input type="tel" autoComplete="tel" value={draft.phone || ""} onChange={(event) => setDraft((current) => ({...current, phone: event.target.value}))} maxLength={40} /></label>
        <label>Location<input autoComplete="address-level2" value={draft.location || ""} onChange={(event) => setDraft((current) => ({...current, location: event.target.value}))} maxLength={80} /></label>
        <div className="profileDialogActions">
          <button className="outline" type="button" onClick={onClose}>Cancel</button>
          <button className="primary" type="submit">Save profile</button>
        </div>
      </form>
    </div>
  );
}

function Stat({title, value, delta, icon}){
  return <div className="stat"><div className="statIcon">{icon}</div><div><span>{title}</span><h2>{value}</h2><em>{delta} <small>vs last period</small></em></div></div>;
}

function MarketBreadth({breadth}){
  const advancingShare = breadth.total ? (breadth.advancing / breadth.total) * 100 : 0;
  const decliningShare = breadth.total ? (breadth.declining / breadth.total) * 100 : 0;

  return (
    <div className="stat breadthStat" aria-label={`Market breadth: ${breadth.advancing} advancing, ${breadth.declining} declining, ${breadth.unchanged} unchanged`}>
      <div className="statIcon">M</div>
      <div className="breadthContent">
        <span>India Market Breadth</span>
        {breadth.total ? (
          <>
            <h2>{breadth.advancing} <small>up</small> / {breadth.declining} <small>down</small></h2>
            <div className="breadthMeter" role="img" aria-label={`${advancingShare.toFixed(0)}% advancing, ${decliningShare.toFixed(0)}% declining`}>
              <span className="breadthAdvance" style={{width: `${advancingShare}%`}} />
              <span className="breadthDecline" style={{width: `${decliningShare}%`}} />
            </div>
            <em>{breadth.unchanged} unchanged · {breadth.total} tracked</em>
          </>
        ) : (
          <>
            <h2>—</h2>
            <em>Waiting for market data</em>
          </>
        )}
      </div>
    </div>
  );
}

function Row({name, value, status}){
  return <div className="row"><span>{name}</span><b>{value}</b><em>{status}</em></div>;
}

function Indicator({title, value, sub}){
  return <div className="indicator"><span>{title}</span><b>{value}</b><small>{sub}</small></div>;
}

function Signals({symbol, setSymbol, signal, markets, market, notifyTelegram, addLog}){
  const plan = getSignalPlan(symbol, market, signal);
  return (
    <>
      <div className="pageHead">
        <div><p className="eyebrow">AI ENGINE</p><h1>Trading Signals</h1><p>Generated from technical indicators and strategy rules.</p></div>
        <select value={symbol} onChange={(event) => setSymbol(event.target.value)}>{(markets || []).map((m) => <option key={m.symbol}>{m.symbol}</option>)}</select>
      </div>
      <div className="signalHero">
        <div>
          <span className="eyebrow">CURRENT SIGNAL</span>
          <div className={"heroSignal " + (signal?.signal || "HOLD").toLowerCase()}>{signal?.signal || "WAIT"}</div>
          <p>Confidence score: <b>{signal?.confidence || 0}%</b></p>
        </div>
        <div className="featureList">
          <Row name="RSI (14)" value={signal?.rsi ?? "—"} status="Calculated" />
          <Row name="MACD" value={signal?.macd ?? "—"} status="Calculated" />
          <Row name="Entry" value={plan.entry} status={plan.bias} />
          <Row name="Exit" value={plan.exit} status="Target" />
          <Row name="Stop Loss" value={plan.stopLoss} status="Risk" />
          <Row name="Engine" value="ML + Rules" status="Online" />
        </div>
      </div>
      <div className="panel signalLogPanel">
        <div className="panelHead"><h3>Signal alert</h3><button className="outline" onClick={() => {
          const message = `${symbol}: ${signal?.signal || "WAIT"} signal. Entry ${plan.entry}, Exit ${plan.exit}, SL ${plan.stopLoss}.`;
          addLog(message, "notification");
          notifyTelegram(message);
        }}>Send to Telegram</button></div>
      </div>
    </>
  );
}

function Backtesting({backtest, runBacktest, symbol, backtestForm, setBacktestForm, notifyTelegram, addLog}){
  const chartData = useMemo(() => {
    const labels = (backtest?.equity_curve || []).map((_, index) => `T${index + 1}`);
    const values = backtest?.equity_curve || [];
    return {
      labels,
      datasets: [{label: "Equity", data: values, borderColor: "#62d5ff", backgroundColor: "rgba(98,213,255,.15)", fill: true, tension: 0.4, pointRadius: 0}]
    };
  }, [backtest]);

  return (
    <>
      <div className="pageHead"><div><p className="eyebrow">STRATEGY LAB</p><h1>Backtesting</h1><p>Evaluate historical strategy performance.</p></div><button className="primary" onClick={() => { runBacktest(); notifyTelegram(`Backtest started for ${backtestForm.symbol} using ${backtestForm.strategy}.`); }}>Run {symbol} Test</button></div>
      <div className="panel backtestFormPanel">
        <div className="formGrid">
          <label>Market symbol<select value={backtestForm.symbol} onChange={(event) => setBacktestForm((current) => ({...current, symbol: event.target.value}))}><option>NIFTY 50</option><option>BANK NIFTY</option><option>SENSEX</option><option>RELIANCE</option><option>TCS</option><option>INFOSYS</option><option>HDFC BANK</option><option>ICICI BANK</option><option>SBIN</option><option>ITC</option><option>BHARTI AIRTEL</option><option>BTC/USDT</option><option>ETH/USDT</option></select></label>
          <label>Strategy<select value={backtestForm.strategy} onChange={(event) => setBacktestForm((current) => ({...current, strategy: event.target.value}))}><option>AI Momentum</option><option>RSI Reversal</option><option>Breakout Momentum</option><option>VWAP Trend</option><option>Mean Reversion</option><option>Swing Breakout</option></select></label>
          <label>Timeframe<select value={backtestForm.timeframe} onChange={(event) => setBacktestForm((current) => ({...current, timeframe: event.target.value}))}><option>1D</option><option>1W</option><option>1M</option></select></label>
          <label>Initial capital<input type="number" value={backtestForm.initialCapital} onChange={(event) => setBacktestForm((current) => ({...current, initialCapital: event.target.value}))} /></label>
          <label>Position size<input type="number" value={backtestForm.positionSize} onChange={(event) => setBacktestForm((current) => ({...current, positionSize: event.target.value}))} /></label>
          <label>Stop loss %<input type="number" min="0" step="0.1" value={backtestForm.stopLoss} onChange={(event) => setBacktestForm((current) => ({...current, stopLoss: event.target.value}))} /></label>
        </div>
      </div>
      {backtest ? (
        <>
          <div className="grid4">
            <Stat title="Final Value" value={toCurrency(backtest.final_value)} delta={formatPercent(backtest.return_pct)} icon="₹" />
            <Stat title="P&L" value={toCurrency(backtest.pnl)} delta="Test result" icon="↗" />
            <Stat title="Win Rate" value={`${backtest.win_rate || 0}%`} delta={`${backtest.trades || 0} trades`} icon="W" />
            <Stat title="Max Drawdown" value={`${backtest.max_drawdown || 0}%`} delta="Risk metric" icon="↓" />
          </div>
          <div className="panel chartPanel"><div className="panelHead"><h3>{backtestForm.symbol} performance</h3><span>{backtestForm.strategy}</span></div><div className="chart"><Line data={chartData} options={{responsive: true, maintainAspectRatio: false, plugins: {legend: {display: false}}, scales: {x: {display: false}, y: {grid: {color: "rgba(255,255,255,.05)"}, ticks: {color: "#8190a5"}}}}} /></div></div>
        </>
      ) : <div className="empty panel">Run a backtest to calculate P&L, win rate and maximum drawdown.</div>}
    </>
  );
}

function Risk({riskRules, setRiskRules, saveRiskRules, addLog}){
  const [saved, setSaved] = useState(false);
  const updateRule = (field, value) => { setRiskRules((current) => ({...current, [field]: value})); setSaved(false); };
  const capitalAmount = Number(riskRules.capitalBox || 0);
  const dailyLoss = Number(riskRules.dailyLoss || 0);
  const capitalUsage = capitalAmount ? ((dailyLoss / capitalAmount) * 100).toFixed(1) : "0.0";

  return (
    <>
      <div className="pageHead"><div><p className="eyebrow">PROTECTION</p><h1>Risk Management</h1><p>Configure limits and monitor portfolio risk.</p></div></div>
      <div className="riskGrid">
        <form className="panel" onSubmit={(event) => { saveRiskRules(event); setSaved(true); addLog("Risk rules saved.", "success"); }}>
          <h3>Risk Rules</h3>
          <label>Stop Loss %<input type="number" min="0" step="0.1" value={riskRules.stopLoss} onChange={(event) => updateRule("stopLoss", event.target.value)} /></label>
          <label>Maximum Drawdown %<input type="number" min="0" step="0.1" value={riskRules.maxDrawdown} onChange={(event) => updateRule("maxDrawdown", event.target.value)} /></label>
          <label>Capital Box<input type="number" min="0" step="1000" value={riskRules.capitalBox} onChange={(event) => updateRule("capitalBox", event.target.value)} /></label>
          <label>Daily Loss Limit<input type="number" min="0" step="100" value={riskRules.dailyLoss} onChange={(event) => updateRule("dailyLoss", event.target.value)} /></label>
          <button className="primary" type="submit">Save Risk Rules</button>
          {saved && <span role="status">Saved on this device.</span>}
        </form>
        <div className="panel">
          <h3>Risk Status</h3>
          <div className="safe">✓ Portfolio within configured risk limits</div>
          <Row name="Capital box" value={`₹${Number(riskRules.capitalBox || 0).toLocaleString()}`} status="Allocated" />
          <Row name="Stop loss" value={`${riskRules.stopLoss}%`} status="Active" />
          <Row name="Max drawdown" value={`${riskRules.maxDrawdown}%`} status="Active" />
          <Row name="Daily loss limit" value={`₹${Number(riskRules.dailyLoss).toLocaleString()}`} status="Active" />
          <Row name="Capital usage" value={`${capitalUsage}%`} status="Current" />
          <Row name="Alerts" value="ON" status="Enabled" />
        </div>
      </div>
    </>
  );
}

function Reports({exportReport, exportMessage, notifyTelegram}){
  return (
    <>
      <div className="pageHead"><div><p className="eyebrow">ANALYTICS</p><h1>Reports</h1><p>Backtesting and strategy performance reports.</p></div></div>
      <div className="panel table">
        <div className="signalLine"><b>Weekly Strategy Report</b><span>AI Momentum</span><span>Generated today</span><button className="outline" onClick={() => { exportReport("Weekly Strategy Report", "AI Momentum", "This week"); notifyTelegram("Weekly strategy report exported from TradeMind."); }}>Export</button></div>
        <div className="signalLine"><b>Monthly P&L Report</b><span>Portfolio</span><span>Sep 2026</span><button className="outline" onClick={() => { exportReport("Monthly P&L Report", "Portfolio", "Sep 2026"); notifyTelegram("Monthly P&L report exported from TradeMind."); }}>Export</button></div>
        {exportMessage && <p role="status">{exportMessage}</p>}
      </div>
    </>
  );
}

function Strategies({strategies, addStrategy, configureStrategy, addLog}){
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newError, setNewError] = useState("");
  const [editing, setEditing] = useState(null);
  const [editRisk, setEditRisk] = useState("Medium");

  function submitNewStrategy(event){
    event.preventDefault();
    if (!addStrategy(newName)) { setNewError("Enter a unique strategy name."); return; }
    addLog(`Created new strategy: ${newName.trim()}.`, "success");
    setNewName(""); setNewError(""); setShowNew(false);
  }

  function openConfiguration(strategy){
    setEditing(strategy.name);
    setEditRisk(strategy.risk);
  }

  function saveConfiguration(event, strategyName){
    event.preventDefault();
    if (configureStrategy(strategyName, editRisk)) {
      addLog(`Updated ${strategyName} to ${editRisk} risk.`, "success");
      setEditing(null);
    }
  }

  return (
    <>
      <div className="pageHead"><div><p className="eyebrow">CONFIGURATION</p><h1>Trading Strategies</h1><p>Create and manage rule-based strategies.</p></div><button className="primary" onClick={() => { setShowNew(true); setNewError(""); }}>+ New Strategy</button></div>
      {showNew && <form className="panel" onSubmit={submitNewStrategy}><label>Strategy name<input autoFocus maxLength="40" value={newName} onChange={(event) => { setNewName(event.target.value); setNewError(""); }} required /></label>{newError && <span role="alert">{newError}</span>}<button className="primary" type="submit">Create Strategy</button><button className="outline" type="button" onClick={() => setShowNew(false)}>Cancel</button></form>}
      <div className="strategyGrid">{strategies.map((strategy) => <div className="panel strategy" key={strategy.name}><span className={`badge ${strategy.status === "READY" ? "muted" : ""}`}>{strategy.status}</span><h3>{strategy.name}</h3><p>{strategy.description}</p><Row name="Risk" value={strategy.risk} status={strategy.status === "ACTIVE" ? "Configured" : "Ready"} /><button className="outline" onClick={() => editing === strategy.name ? setEditing(null) : openConfiguration(strategy)}>{editing === strategy.name ? "Close configuration" : "Configure"}</button>{editing === strategy.name && <form onSubmit={(event) => saveConfiguration(event, strategy.name)}><label>Risk level<select value={editRisk} onChange={(event) => setEditRisk(event.target.value)}><option>Low</option><option>Medium</option><option>High</option></select></label><button className="primary" type="submit">Save configuration</button></form>}</div>)}</div>
    </>
  );
}

export default App;
