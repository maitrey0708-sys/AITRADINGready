import React, {useEffect, useMemo, useState} from "react";
import {Line} from "react-chartjs-2";
import {Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler} from "chart.js";
import {LayoutDashboard, Activity, FlaskConical, ShieldCheck, FileText, Settings, Bell, Search, Menu, TrendingUp, TrendingDown} from "lucide-react";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

const API="/api";
const nav=[
  ["Dashboard",LayoutDashboard],["Signals",Activity],["Backtesting",FlaskConical],
  ["Risk Management",ShieldCheck],["Reports",FileText],["Strategies",Settings]
];

function App(){
 const [page,setPage]=useState("Dashboard");
 const [symbol,setSymbol]=useState("NIFTY 50");
 const [markets,setMarkets]=useState([]);
 const [market,setMarket]=useState(null);
 const [signal,setSignal]=useState(null);
 const [backtest,setBacktest]=useState(null);
 const [searchQuery,setSearchQuery]=useState("");
 const [exportMessage,setExportMessage]=useState("");
 const [riskRules,setRiskRules]=useState(()=>{
   try{return JSON.parse(localStorage.getItem("trademind-risk-rules"))||{stopLoss:"2.0",maxDrawdown:"8.0",dailyLoss:"5000"}}
   catch{return {stopLoss:"2.0",maxDrawdown:"8.0",dailyLoss:"5000"}}
 });
 const [strategies,setStrategies]=useState([
   {name:"AI Momentum",risk:"Medium",status:"ACTIVE",description:"Combines SMA, RSI and MACD conditions for signal generation."},
   {name:"RSI Reversal",risk:"Medium",status:"READY",description:"Uses RSI oversold/overbought zones for reversal entries."}
 ]);

 useEffect(()=>{
   const loadMarkets=()=>fetch(API+"/markets").then(r=>r.json()).then(setMarkets).catch(()=>{});
   loadMarkets();
   const timer=setInterval(loadMarkets,15000);
   return ()=>clearInterval(timer);
 },[]);
 useEffect(()=>{
   Promise.all([fetch(API+"/market/"+encodeURIComponent(symbol)).then(r=>r.json()),
                fetch(API+"/signal/"+encodeURIComponent(symbol)).then(r=>r.json())])
   .then(([m,s])=>{setMarket(m);setSignal(s)}).catch(()=>{});
 },[symbol]);
 useEffect(()=>{
   const timer=setInterval(()=>{
     fetch(API+"/market/"+encodeURIComponent(symbol)).then(r=>r.json()).then(setMarket).catch(()=>{});
     fetch(API+"/signal/"+encodeURIComponent(symbol)).then(r=>r.json()).then(setSignal).catch(()=>{});
   },15000);
   return ()=>clearInterval(timer);
 },[symbol]);

 const chart=useMemo(()=>market?{
   labels:(market?.series||[]).map(x=>x.time),
   datasets:[{label:"Price",data:(market.series||[]).map(x=>x.close),borderWidth:2,pointRadius:0,tension:.35,fill:true}]
 }:{labels:[],datasets:[]},[market]);

 async function runBacktest(){
   const r=await fetch(API+"/backtest?symbol="+encodeURIComponent(symbol)+"&initial_capital=100000",{method:"POST"});
   setBacktest(await r.json()); setPage("Backtesting");
 }
 function handleSearch(event){
   if(event.key!=="Enter")return;
   const query=searchQuery.trim().toLowerCase();
   if(!query)return;
   const marketMatch=markets.find(item=>item.symbol.toLowerCase().includes(query));
   const pageMatch=nav.find(([name])=>name.toLowerCase().includes(query));
   if(marketMatch){setSymbol(marketMatch.symbol);setPage("Dashboard")}
   else if(pageMatch)setPage(pageMatch[0]);
   else if(strategies.some(item=>item.name.toLowerCase().includes(query)))setPage("Strategies");
   else alert(`No market, section, or strategy found for "${searchQuery.trim()}".`);
   setSearchQuery("");
 }
 function saveRiskRules(event){
   event.preventDefault();
   localStorage.setItem("trademind-risk-rules",JSON.stringify(riskRules));
 }
 function addStrategy(name){
   if(!name?.trim()||strategies.some(item=>item.name.toLowerCase()===name.trim().toLowerCase()))return false;
   setStrategies(current=>[...current,{name:name.trim(),risk:"Medium",status:"READY",description:"Custom strategy configuration."}]);
   return true;
 }
 function configureStrategy(name,risk){
   const normalizedRisk=risk.trim().toLowerCase();
   if(!["low","medium","high"].includes(normalizedRisk))return false;
   setStrategies(current=>current.map(item=>item.name===name?{...item,risk:normalizedRisk[0].toUpperCase()+normalizedRisk.slice(1)}:item));
   return true;
 }
 function exportReport(title,scope,period){
   const rows=[["Report","Scope","Period","Generated"],[title,scope,period,new Date().toLocaleDateString()]];
   const csv=rows.map(row=>row.map(value=>`"${String(value).replace(/"/g,'""')}"`).join(",")).join("\r\n");
   const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
   const link=document.createElement("a");
   link.href=url;
   link.download=`${title.toLowerCase().replace(/[^a-z0-9]+/g,"-")}.csv`;
   document.body.appendChild(link);
   link.click();
   link.remove();
   window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  setExportMessage(`${title} exported as ${link.download}.`);
 }
 return <div className="app">
   <aside className="sidebar">
     <div className="brand"><div className="brandIcon">AI</div><div><b>TradeMind</b><small>AI Trading Lab</small></div></div>
     <div className="sectionLabel">WORKSPACE</div>
     {nav.map(([name,Icon])=><button key={name} className={page===name?"nav active":"nav"} onClick={()=>setPage(name)}><Icon size={18}/>{name}</button>)}
     <div className="sidebarBottom"><div className="riskMini"><span>●</span> System online<small>Market data connected</small></div></div>
   </aside>
   <main>
    <header><button className="mobileMenu" aria-label="Toggle navigation" onClick={()=>document.querySelector(".sidebar")?.classList.toggle("open")}><Menu/></button><div className="search"><Search size={17}/><input aria-label="Search symbols, strategies, or sections" placeholder="Search symbol, strategy..." value={searchQuery} onChange={event=>setSearchQuery(event.target.value)} onKeyDown={handleSearch}/></div><div className="topActions"><button className="iconButton" aria-label="Notifications" onClick={()=>alert("No new notifications") }><Bell/></button><div className="avatar">MJ</div></div></header>
     <div className="content">
      {page==="Dashboard" && <Dashboard markets={markets} symbol={symbol} setSymbol={setSymbol} market={market} signal={signal} chart={chart} runBacktest={runBacktest} onViewAll={()=>setPage("Signals")}/>}
       {page==="Signals" && <Signals symbol={symbol} setSymbol={setSymbol} signal={signal} markets={markets}/>}
       {page==="Backtesting" && <Backtesting backtest={backtest} runBacktest={runBacktest} symbol={symbol}/>}
      {page==="Risk Management" && <Risk riskRules={riskRules} setRiskRules={setRiskRules} saveRiskRules={saveRiskRules}/>}
      {page==="Reports" && <Reports exportReport={exportReport} exportMessage={exportMessage}/>}
      {page==="Strategies" && <Strategies strategies={strategies} addStrategy={addStrategy} configureStrategy={configureStrategy}/>}
     </div>
   </main>
 </div>
}

function Dashboard({markets,symbol,setSymbol,market,signal,chart,runBacktest,onViewAll}){
 return <><div className="pageHead"><div><p className="eyebrow">OVERVIEW</p><h1>Trading Dashboard</h1><p>AI-powered market intelligence and strategy monitoring.</p></div><button className="primary" onClick={runBacktest}>Run Backtest</button></div>
 <div className="marketStrip">{markets.map(m=><button type="button" className={"marketPill "+(m.symbol===symbol?"selected":"")} onClick={()=>setSymbol(m.symbol)} key={m.symbol}><span>{m.symbol}</span><b>{m.price.toLocaleString()}</b><em className={m.change>=0?"up":"down"}>{m.change>=0?"+":""}{m.change}%</em></button>)}</div>
 <div className="grid4"><Stat title="Portfolio Value" value="₹1,24,680" delta="+8.42%" icon="₹"/><Stat title="Today's P&L" value="+₹4,280" delta="+3.56%" icon="↗"/><Stat title="Win Rate" value="72.4%" delta="+4.1%" icon="W"/><Stat title="Max Drawdown" value="6.8%" delta="-1.2%" icon="↓"/></div>
 <div className="mainGrid"><div className="panel chartPanel"><div className="panelHead"><div><h3>{symbol} <span className="liveDot">{market?.live ? "LIVE" : "DEMO"}</span></h3><span className="bigPrice">{market?.price?.toLocaleString(undefined,{maximumFractionDigits:2})||"—"}</span></div><select value={symbol} onChange={e=>setSymbol(e.target.value)}>{markets.map(m=><option key={m.symbol}>{m.symbol}</option>)}</select></div><div className="chart"><Line data={chart} options={{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{display:false},y:{grid:{color:"rgba(255,255,255,.05)"},ticks:{color:"#8190a5"}}}}}/></div></div>
 <div className="panel signalPanel"><div className="panelHead"><h3>AI Signal</h3><span className="badge">MODEL v1.0</span></div><div className={"signal "+(signal?.signal||"HOLD").toLowerCase()}>{signal?.signal||"WAIT"}<small>{signal?.confidence||0}% confidence</small></div><div className="meter"><span style={{width:`${signal?.confidence||0}%`}}/></div><div className="indicatorRows"><Row name="RSI" value={signal?.rsi??"—"} status={signal?.rsi>70?"Overbought":"Neutral"}/><Row name="MACD" value={signal?.macd??"—"} status="Trend"/><Row name="Strategy" value="AI Momentum" status="Active"/></div><button className="outline" onClick={()=>alert(`${symbol}: ${signal?.signal||"WAIT"} signal with ${signal?.confidence||0}% confidence.`)}>View Signal Details</button></div></div>
 <div className="bottomGrid"><div className="panel"><div className="panelHead"><h3>Technical Indicators</h3><span>Live</span></div><div className="indicatorCards"><Indicator title="RSI (14)" value={signal?.rsi??"—"} sub="Neutral zone"/><Indicator title="MACD" value={signal?.macd??"—"} sub="Momentum"/><Indicator title="SMA (20)" value={market?.indicators?.sma20?.toLocaleString()??"—"} sub="Trend support"/><Indicator title="Volume" value="2.4M" sub="Above average"/></div></div><div className="panel activity"><div className="panelHead"><h3>Recent Signals</h3><button className="linkButton" onClick={onViewAll}>View all</button></div><div className="signalLine"><i className="buy">BUY</i><b>NIFTY 50</b><span>09:42 AM</span><strong>₹25,842</strong></div><div className="signalLine"><i className="sell">SELL</i><b>BTC/USDT</b><span>09:18 AM</span><strong>$112,640</strong></div><div className="signalLine"><i className="hold">HOLD</i><b>BANK NIFTY</b><span>08:57 AM</span><strong>58,320</strong></div></div></div>
 </>}
function Stat({title,value,delta,icon}){return <div className="stat"><div className="statIcon">{icon}</div><div><span>{title}</span><h2>{value}</h2><em>{delta} <small>vs last period</small></em></div></div>}
function Row({name,value,status}){return <div className="row"><span>{name}</span><b>{value}</b><em>{status}</em></div>}
function Indicator({title,value,sub}){return <div className="indicator"><span>{title}</span><b>{value}</b><small>{sub}</small></div>}

function Signals({symbol,setSymbol,signal,markets}){return <><div className="pageHead"><div><p className="eyebrow">AI ENGINE</p><h1>Trading Signals</h1><p>Generated from technical indicators and strategy rules.</p></div><select value={symbol} onChange={e=>setSymbol(e.target.value)}>{markets.map(m=><option key={m.symbol}>{m.symbol}</option>)}</select></div><div className="signalHero"><div><span className="eyebrow">CURRENT SIGNAL</span><div className={"heroSignal "+(signal?.signal||"HOLD").toLowerCase()}>{signal?.signal||"WAIT"}</div><p>Confidence score: <b>{signal?.confidence||0}%</b></p></div><div className="featureList"><Row name="RSI (14)" value={signal?.rsi??"—"} status="Calculated"/><Row name="MACD" value={signal?.macd??"—"} status="Calculated"/><Row name="Engine" value="ML + Rules" status="Online"/></div></div></>}
function Backtesting({backtest,runBacktest,symbol}){return <><div className="pageHead"><div><p className="eyebrow">STRATEGY LAB</p><h1>Backtesting</h1><p>Evaluate historical strategy performance.</p></div><button className="primary" onClick={runBacktest}>Run {symbol} Test</button></div>{backtest?<div className="grid4"><Stat title="Final Value" value={"₹"+backtest.final_value.toLocaleString()} delta={(backtest.return_pct>=0?"+":"")+backtest.return_pct+"%"} icon="₹"/><Stat title="P&L" value={"₹"+backtest.pnl.toLocaleString()} delta="Test result" icon="↗"/><Stat title="Win Rate" value={backtest.win_rate+"%"} delta={backtest.trades+" trades"} icon="W"/><Stat title="Max Drawdown" value={backtest.max_drawdown+"%"} delta="Risk metric" icon="↓"/></div>:<div className="empty panel">Run a backtest to calculate P&L, win rate and maximum drawdown.</div>}</>}
function Risk({riskRules,setRiskRules,saveRiskRules}){
 const [saved,setSaved]=useState(false);
 const updateRule=(field,value)=>{setRiskRules(current=>({...current,[field]:value}));setSaved(false)};
 return <><div className="pageHead"><div><p className="eyebrow">PROTECTION</p><h1>Risk Management</h1><p>Configure limits and monitor portfolio risk.</p></div></div><div className="riskGrid"><form className="panel" onSubmit={event=>{saveRiskRules(event);setSaved(true)}}><h3>Risk Rules</h3><label>Stop Loss %<input type="number" min="0" step="0.1" value={riskRules.stopLoss} onChange={event=>updateRule("stopLoss",event.target.value)}/></label><label>Maximum Drawdown %<input type="number" min="0" step="0.1" value={riskRules.maxDrawdown} onChange={event=>updateRule("maxDrawdown",event.target.value)}/></label><label>Daily Loss Limit<input type="number" min="0" step="100" value={riskRules.dailyLoss} onChange={event=>updateRule("dailyLoss",event.target.value)}/></label><button className="primary" type="submit">Save Risk Rules</button>{saved&&<span role="status">Saved on this device.</span>}</form><div className="panel"><h3>Risk Status</h3><div className="safe">✓ Portfolio within configured risk limits</div><Row name="Stop loss" value={`${riskRules.stopLoss}%`} status="Active"/><Row name="Max drawdown" value={`${riskRules.maxDrawdown}%`} status="Active"/><Row name="Daily loss limit" value={`₹${Number(riskRules.dailyLoss).toLocaleString()}`} status="Active"/><Row name="Alerts" value="ON" status="Enabled"/></div></div></>;
}
function Reports({exportReport,exportMessage}){return <><div className="pageHead"><div><p className="eyebrow">ANALYTICS</p><h1>Reports</h1><p>Backtesting and strategy performance reports.</p></div></div><div className="panel table"><div className="signalLine"><b>Weekly Strategy Report</b><span>AI Momentum</span><span>Generated today</span><button className="outline" onClick={()=>exportReport("Weekly Strategy Report","AI Momentum","This week")}>Export</button></div><div className="signalLine"><b>Monthly P&L Report</b><span>Portfolio</span><span>Sep 2026</span><button className="outline" onClick={()=>exportReport("Monthly P&L Report","Portfolio","Sep 2026")}>Export</button></div>{exportMessage&&<p role="status">{exportMessage}</p>}</div></>}
function Strategies({strategies,addStrategy,configureStrategy}){
 const [showNew,setShowNew]=useState(false);
 const [newName,setNewName]=useState("");
 const [newError,setNewError]=useState("");
 const [editing,setEditing]=useState(null);
 const [editRisk,setEditRisk]=useState("Medium");
 function submitNewStrategy(event){
   event.preventDefault();
   if(!addStrategy(newName)){setNewError("Enter a unique strategy name.");return}
   setNewName("");setNewError("");setShowNew(false);
 }
 function openConfiguration(strategy){
   setEditing(strategy.name);
   setEditRisk(strategy.risk);
 }
 function saveConfiguration(event,strategyName){
   event.preventDefault();
   if(configureStrategy(strategyName,editRisk))setEditing(null);
 }
 return <><div className="pageHead"><div><p className="eyebrow">CONFIGURATION</p><h1>Trading Strategies</h1><p>Create and manage rule-based strategies.</p></div><button className="primary" onClick={()=>{setShowNew(true);setNewError("")}}>+ New Strategy</button></div>{showNew&&<form className="panel" onSubmit={submitNewStrategy}><label>Strategy name<input autoFocus maxLength="40" value={newName} onChange={event=>{setNewName(event.target.value);setNewError("")}} required/></label>{newError&&<span role="alert">{newError}</span>}<button className="primary" type="submit">Create Strategy</button><button className="outline" type="button" onClick={()=>setShowNew(false)}>Cancel</button></form>}<div className="strategyGrid">{strategies.map(strategy=><div className="panel strategy" key={strategy.name}><span className={`badge ${strategy.status==="READY"?"muted":""}`}>{strategy.status}</span><h3>{strategy.name}</h3><p>{strategy.description}</p><Row name="Risk" value={strategy.risk} status={strategy.status==="ACTIVE"?"Configured":"Ready"}/><button className="outline" onClick={()=>editing===strategy.name?setEditing(null):openConfiguration(strategy)}>{editing===strategy.name?"Close configuration":"Configure"}</button>{editing===strategy.name&&<form onSubmit={event=>saveConfiguration(event,strategy.name)}><label>Risk level<select value={editRisk} onChange={event=>setEditRisk(event.target.value)}><option>Low</option><option>Medium</option><option>High</option></select></label><button className="primary" type="submit">Save configuration</button></form>}</div>)}</div></>;
}
export default App;
