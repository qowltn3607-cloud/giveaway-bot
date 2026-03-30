import React, { useState, useRef, useEffect } from "react";

const buildSystemPrompt = (info) => `당신은 오프라인 마케팅 행사 전문 기버웨이(Giveaway) & 굿즈 브레인스토밍 전문가입니다.
웹 검색 도구를 반드시 여러 번 활용해 Instagram, X(Twitter), YouTube, Google 등 플랫폼에서 실제로 화제가 된 최신 사례를 찾아 답변하세요.

== 현재 행사 정보 ==
• 브랜드/제품: ${info.brand}
• 행사 유형: ${info.eventType}
• 타겟 고객: ${info.target}
• 예산 (개당): ${info.budget}
• 행사 목표: ${info.goal}
• 추가 메모: ${info.memo || "없음"}

== 필수 검색 전략 — 반드시 아래 순서로 검색하세요 ==

1. Instagram 트렌드 검색
   - "site:instagram.com brand event giveaway 2025" 또는
   - "Instagram viral brand giveaway popup 2025"
   - "인스타그램 브랜드 팝업 굿즈 바이럴 2025"

2. X(Twitter) 트렌드 검색
   - "Twitter X brand event swag giveaway trending 2025"
   - "브랜드 이벤트 굿즈 트위터 반응 2025"

3. YouTube/구글 사례 검색
   - "YouTube brand activation giveaway ideas 2025"
   - "${info.brand} 오프라인 이벤트 굿즈" 또는 "${info.eventType} giveaway ideas 2025"
   - "brand ${info.goal} offline event giveaway viral"

4. 타겟 특화 검색
   - "${info.target} 좋아하는 굿즈 트렌드 2025"
   - "${info.target} brand merch popular 2025"

== 답변 형식 ==
- 검색에서 찾은 실제 플랫폼 반응/사례를 먼저 언급 (예: "Instagram에서 ○○ 브랜드가 이걸로 X만 좋아요를 받았어요")
- 플랫폼별로 어떤 굿즈/기버웨이가 바이럴됐는지 구체적으로 설명
- 카테고리별 아이디어 정리 (Instagram 바이럴형 / X 화제형 / 실용형 / 프리미엄형)
- 각 아이디어에 예상 SNS 반응과 행사 효과 포함
- 이모지 적극 활용 🎁✨🔥📸
- 마지막에 후속 질문이나 발전 방향 제시
- 한국어로 대화`;

const EVENT_TYPES = ["팝업 스토어","컨퍼런스 / 세미나","브랜드 페스티벌","트레이드쇼 / 전시회","사내 행사","제품 론칭 이벤트","커뮤니티 밋업","기타"];
const BUDGET_OPTIONS = ["~3,000원","3,000~8,000원","8,000~20,000원","20,000~50,000원","50,000원~"];
const GOAL_OPTIONS = ["브랜드 인지도 향상","신제품 홍보","SNS 바이럴 유도","리드 수집 / 가입 유도","고객 로열티 강화","커뮤니티 형성"];

const WEB_SEARCH_TOOL = {
  type: "web_search_20250305",
  name: "web_search",
};

export default function GiveawayBot() {
  const [step, setStep] = useState("form");
  const [formData, setFormData] = useState({ brand:"", eventType:"", target:"", budget:"", goal:"", memo:"" });
  const [errors, setErrors] = useState({});
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchingWeb, setSearchingWeb] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages, searchingWeb]);

  const validate = () => {
    const e = {};
    if (!formData.brand.trim()) e.brand = "브랜드/제품명을 입력해주세요";
    if (!formData.eventType) e.eventType = "행사 유형을 선택해주세요";
    if (!formData.target.trim()) e.target = "타겟 고객층을 입력해주세요";
    if (!formData.budget) e.budget = "예산 범위를 선택해주세요";
    if (!formData.goal) e.goal = "행사 목표를 선택해주세요";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // 웹 서칭 포함 API 호출 — tool_use 루프 처리
  const callAPI = async (history) => {
    let currentMessages = [...history];
    setSearchingWeb(false);

    while (true) {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: buildSystemPrompt(formData),
          tools: [WEB_SEARCH_TOOL],
          messages: currentMessages,
        }),
      });

      const data = await res.json();
      const { content, stop_reason } = data;

      // 텍스트만 추출
      const textBlocks = content.filter(b => b.type === "text");
      const toolUseBlocks = content.filter(b => b.type === "tool_use");

      // 검색 중 표시
      if (toolUseBlocks.length > 0) {
        setSearchingWeb(true);
      }

      // 최종 응답 (end_turn)
      if (stop_reason === "end_turn" || toolUseBlocks.length === 0) {
        setSearchingWeb(false);
        return textBlocks.map(b => b.text).join("") || "응답을 받지 못했어요.";
      }

      // tool_use → tool_result 추가 후 루프 계속
      currentMessages = [
        ...currentMessages,
        { role: "assistant", content },
        {
          role: "user",
          content: toolUseBlocks.map(tb => ({
            type: "tool_result",
            tool_use_id: tb.id,
            content: tb.input?.query ? `Searched: ${tb.input.query}` : "search completed",
          })),
        },
      ];
    }
  };

  const handleFormSubmit = async () => {
    if (!validate()) return;
    setStep("chat");
    setLoading(true);
    const firstMsg = `안녕! 아래 행사 정보 기반으로 기버웨이 아이디어 브레인스토밍 시작해줘! 최신 트렌드와 실제 브랜드 사례를 웹에서 검색해서 알려줘.\n• 브랜드/제품: ${formData.brand}\n• 행사 유형: ${formData.eventType}\n• 타겟 고객: ${formData.target}\n• 예산 (개당): ${formData.budget}\n• 행사 목표: ${formData.goal}${formData.memo ? `\n• 추가 메모: ${formData.memo}` : ""}`;
    try {
      const reply = await callAPI([{ role:"user", content: firstMsg }]);
      setMessages([{ role:"assistant", content: reply }]);
    } catch(err) {
      setMessages([{ role:"assistant", content:"⚠️ 오류가 발생했어요. 다시 시도해주세요." }]);
    } finally {
      setLoading(false);
      setSearchingWeb(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const newMessages = [...messages, { role:"user", content: text }];
    setMessages(newMessages);
    setLoading(true);
    try {
      const reply = await callAPI(newMessages.map(m => ({ role: m.role, content: m.content })));
      setMessages(prev => [...prev, { role:"assistant", content: reply }]);
    } catch {
      setMessages(prev => [...prev, { role:"assistant", content:"⚠️ 오류가 발생했어요." }]);
    } finally {
      setLoading(false);
      setSearchingWeb(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const renderText = (text) =>
    text.split("\n").map((line, i, arr) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
        p.startsWith("**") && p.endsWith("**")
          ? <strong key={j} style={{ color:"#FF8A55", fontWeight:700 }}>{p.slice(2,-2)}</strong>
          : <span key={j}>{p}</span>
      );
      return <span key={i}>{parts}{i < arr.length - 1 && <br />}</span>;
    });

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-thumb { background: #2a2a3a; border-radius: 4px; }

    .text-input {
      width: 100%; background: rgba(255,255,255,0.04);
      border: 1.5px solid rgba(255,255,255,0.09); border-radius: 12px;
      padding: 11px 14px; color: #E8E8F0; font-size: 14px;
      font-family: inherit; outline: none;
      transition: border-color .2s, background .2s;
    }
    .text-input:focus { border-color: rgba(255,122,69,.6); background: rgba(255,255,255,.06); }
    .text-input::placeholder { color: rgba(232,232,240,.25); }
    .text-input.err { border-color: rgba(255,107,107,.6); }

    .chip {
      padding: 8px 14px; border-radius: 50px; font-size: 13px;
      font-family: inherit; cursor: pointer;
      border: 1.5px solid rgba(255,255,255,.1);
      background: rgba(255,255,255,.03); color: rgba(232,232,240,.6);
      transition: all .18s;
    }
    .chip:hover { border-color: rgba(255,122,69,.4); color: #FFB090; }
    .chip.on { border-color: #FF7A45; background: rgba(255,122,69,.15); color: #FF9A6C; font-weight: 700; }
    .chip.err { border-color: rgba(255,107,107,.5); }

    .submit-btn {
      width: 100%; padding: 14px; border-radius: 14px; border: none;
      background: linear-gradient(135deg,#FF6B35,#FF3F8A); color: white;
      font-size: 15px; font-weight: 700; font-family: inherit; cursor: pointer;
      transition: all .2s; letter-spacing: -.2px;
    }
    .submit-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(255,107,53,.4); }

    .bubble-bot {
      background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08);
      border-radius: 6px 20px 20px 20px; padding: 14px 18px;
      max-width: 82%; line-height: 1.78; font-size: 14px; word-break: break-word;
    }
    .bubble-user {
      background: linear-gradient(135deg,#FF6B35,#FF3F8A);
      border-radius: 20px 20px 6px 20px; padding: 12px 16px;
      max-width: 75%; line-height: 1.6; font-size: 14px;
      color: white; word-break: break-word;
      box-shadow: 0 4px 16px rgba(255,107,53,.3);
    }
    .chat-input {
      flex: 1; background: rgba(255,255,255,.04);
      border: 1.5px solid rgba(255,255,255,.09); border-radius: 14px;
      padding: 12px 16px; color: #E8E8F0; font-size: 14px;
      font-family: inherit; resize: none; outline: none;
      transition: border-color .2s; max-height: 120px;
    }
    .chat-input:focus { border-color: rgba(255,122,69,.5); }
    .chat-input::placeholder { color: rgba(232,232,240,.25); }
    .send-btn {
      width: 44px; height: 44px;
      background: linear-gradient(135deg,#FF6B35,#FF3F8A);
      border: none; border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; flex-shrink: 0; transition: all .2s;
    }
    .send-btn:hover:not(:disabled) { transform: scale(1.06); box-shadow: 0 4px 16px rgba(255,107,53,.4); }
    .send-btn:disabled { opacity: .35; cursor: not-allowed; }

    .dot { width:6px; height:6px; border-radius:50%; background:#FF7A45; animation: blink 1.2s infinite; }
    .dot:nth-child(2){animation-delay:.2s} .dot:nth-child(3){animation-delay:.4s}
    @keyframes blink{0%,80%,100%{opacity:.2;transform:scale(.8)}40%{opacity:1;transform:scale(1)}}

    .searching-bar {
      display: flex; align-items: center; gap: 8px;
      background: rgba(99,179,237,0.08);
      border: 1px solid rgba(99,179,237,0.2);
      border-radius: 10px; padding: 9px 14px;
      font-size: 12.5px; color: rgba(99,179,237,0.9);
      max-width: 82%; animation: fadeIn .3s ease;
    }
    @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
    .search-spin {
      width: 14px; height: 14px; border-radius: 50%;
      border: 2px solid rgba(99,179,237,0.3);
      border-top-color: rgba(99,179,237,0.9);
      animation: spin .8s linear infinite; flex-shrink: 0;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .web-badge {
      display: inline-flex; align-items: center; gap: 4px;
      background: rgba(99,179,237,0.1); border: 1px solid rgba(99,179,237,0.25);
      border-radius: 6px; padding: 2px 8px; font-size: 11px;
      color: rgba(99,179,237,0.8); margin-bottom: 10px;
    }

    .reset-btn {
      background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1);
      border-radius: 8px; color: rgba(232,232,240,.4); font-size: 12px;
      font-family: inherit; padding: 5px 12px; cursor: pointer; transition: all .2s;
    }
    .reset-btn:hover { color: rgba(232,232,240,.7); border-color: rgba(255,255,255,.2); }
    .tag {
      display: inline-block; background: rgba(255,122,69,.15);
      border: 1px solid rgba(255,122,69,.3); color: #FF9A6C;
      border-radius: 50px; padding: 2px 10px; font-size: 12px; font-weight: 600;
      margin: 2px 3px 2px 0;
    }
  `;

  const base = { minHeight:"100vh", background:"linear-gradient(135deg,#0A0A0F,#12121A,#0D0D15)", fontFamily:"'Noto Sans KR','Apple SD Gothic Neo',sans-serif", color:"#E8E8F0" };

  // ── FORM ──────────────────────────────────
  if (step === "form") return (
    <div style={{ ...base, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"32px 20px" }}>
      <style>{css}</style>
      <div style={{ textAlign:"center", marginBottom:28 }}>
        <div style={{ fontSize:38, marginBottom:10 }}>🎁</div>
        <h1 style={{ fontSize:22, fontWeight:800, letterSpacing:"-.5px", background:"linear-gradient(135deg,#FF7A45,#FF3F8A)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>기버웨이 브레인스토밍 봇</h1>
        <p style={{ marginTop:6, fontSize:13, color:"rgba(232,232,240,.4)", lineHeight:1.6 }}>행사 정보를 입력하면 Instagram · X · YouTube · Google 실시간 검색 기반으로 최신 굿즈 아이디어를 제안해드려요</p>
        <div style={{ marginTop:10, display:"inline-flex", alignItems:"center", gap:5, background:"rgba(99,179,237,0.08)", border:"1px solid rgba(99,179,237,0.2)", borderRadius:20, padding:"4px 12px", fontSize:12, color:"rgba(99,179,237,0.8)" }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background:"rgba(99,179,237,0.9)", boxShadow:"0 0 6px rgba(99,179,237,0.6)" }} />
          Instagram · X · YouTube · Google 검색 활성화
        </div>
      </div>

      <div style={{ background:"rgba(255,255,255,.035)", border:"1px solid rgba(255,255,255,.08)", borderRadius:20, padding:"32px", width:"100%", maxWidth:560 }}>
        {/* 브랜드 */}
        <div style={{ marginBottom:22 }}>
          <div style={{ fontSize:13, fontWeight:600, color:"rgba(232,232,240,.65)", marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
            🏷️ 브랜드 / 제품명 <span style={{ color:"#FF6B6B", fontSize:11 }}>필수</span>
          </div>
          <input className={`text-input${errors.brand?" err":""}`} placeholder="예: 카카오, 나이키, 신제품 앱 등" value={formData.brand} onChange={e=>{ setFormData(p=>({...p,brand:e.target.value})); setErrors(p=>({...p,brand:""})); }} />
          {errors.brand && <div style={{ fontSize:11.5, color:"#FF8080", marginTop:5 }}>{errors.brand}</div>}
        </div>

        {/* 행사 유형 */}
        <div style={{ marginBottom:22 }}>
          <div style={{ fontSize:13, fontWeight:600, color:"rgba(232,232,240,.65)", marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
            🎪 행사 유형 <span style={{ color:"#FF6B6B", fontSize:11 }}>필수</span>
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            {EVENT_TYPES.map(t=>(
              <button key={t} className={`chip${formData.eventType===t?" on":""}${errors.eventType&&!formData.eventType?" err":""}`} onClick={()=>{ setFormData(p=>({...p,eventType:t})); setErrors(p=>({...p,eventType:""})); }}>{t}</button>
            ))}
          </div>
          {errors.eventType && <div style={{ fontSize:11.5, color:"#FF8080", marginTop:5 }}>{errors.eventType}</div>}
        </div>

        {/* 타겟 */}
        <div style={{ marginBottom:22 }}>
          <div style={{ fontSize:13, fontWeight:600, color:"rgba(232,232,240,.65)", marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
            🎯 타겟 고객층 <span style={{ color:"#FF6B6B", fontSize:11 }}>필수</span>
          </div>
          <input className={`text-input${errors.target?" err":""}`} placeholder="예: 20-30대 직장인, IT 스타트업 종사자 등" value={formData.target} onChange={e=>{ setFormData(p=>({...p,target:e.target.value})); setErrors(p=>({...p,target:""})); }} />
          {errors.target && <div style={{ fontSize:11.5, color:"#FF8080", marginTop:5 }}>{errors.target}</div>}
        </div>

        {/* 예산 */}
        <div style={{ marginBottom:22 }}>
          <div style={{ fontSize:13, fontWeight:600, color:"rgba(232,232,240,.65)", marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
            💰 굿즈 개당 예산 <span style={{ color:"#FF6B6B", fontSize:11 }}>필수</span>
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            {BUDGET_OPTIONS.map(b=>(
              <button key={b} className={`chip${formData.budget===b?" on":""}${errors.budget&&!formData.budget?" err":""}`} onClick={()=>{ setFormData(p=>({...p,budget:b})); setErrors(p=>({...p,budget:""})); }}>{b}</button>
            ))}
          </div>
          {errors.budget && <div style={{ fontSize:11.5, color:"#FF8080", marginTop:5 }}>{errors.budget}</div>}
        </div>

        {/* 목표 */}
        <div style={{ marginBottom:22 }}>
          <div style={{ fontSize:13, fontWeight:600, color:"rgba(232,232,240,.65)", marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
            🚀 행사 목표 <span style={{ color:"#FF6B6B", fontSize:11 }}>필수</span>
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            {GOAL_OPTIONS.map(g=>(
              <button key={g} className={`chip${formData.goal===g?" on":""}${errors.goal&&!formData.goal?" err":""}`} onClick={()=>{ setFormData(p=>({...p,goal:g})); setErrors(p=>({...p,goal:""})); }}>{g}</button>
            ))}
          </div>
          {errors.goal && <div style={{ fontSize:11.5, color:"#FF8080", marginTop:5 }}>{errors.goal}</div>}
        </div>

        {/* 메모 */}
        <div style={{ marginBottom:28 }}>
          <div style={{ fontSize:13, fontWeight:600, color:"rgba(232,232,240,.65)", marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
            📝 추가 메모 <span style={{ color:"rgba(232,232,240,.3)", fontSize:11 }}>선택</span>
          </div>
          <textarea className="text-input" style={{ resize:"none", lineHeight:1.6 }} rows={3} placeholder="행사 테마, 특이사항, 브랜드 분위기 등 자유롭게 입력하세요" value={formData.memo} onChange={e=>setFormData(p=>({...p,memo:e.target.value}))} />
        </div>

        <button className="submit-btn" onClick={handleFormSubmit}>아이디어 브레인스토밍 시작하기 ✨</button>
      </div>
    </div>
  );

  // ── CHAT ──────────────────────────────────
  return (
    <div style={{ ...base, display:"flex", flexDirection:"column" }}>
      <style>{css}</style>

      {/* 헤더 */}
      <div style={{ padding:"16px 20px", borderBottom:"1px solid rgba(255,255,255,.06)", display:"flex", alignItems:"center", gap:12, background:"rgba(255,255,255,.015)", backdropFilter:"blur(20px)", flexShrink:0 }}>
        <div style={{ width:36, height:36, background:"linear-gradient(135deg,#FF6B35,#FF3F8A)", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>🎁</div>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:700, fontSize:14, display:"flex", alignItems:"center", gap:8 }}>
            기버웨이 브레인스토밍
            <span style={{ display:"inline-flex", alignItems:"center", gap:4, background:"rgba(99,179,237,0.1)", border:"1px solid rgba(99,179,237,0.2)", borderRadius:6, padding:"1px 7px", fontSize:10.5, color:"rgba(99,179,237,0.8)", fontWeight:500 }}>
              <div style={{ width:5, height:5, borderRadius:"50%", background:"rgba(99,179,237,0.9)" }} /> Instagram · X · YouTube
            </span>
          </div>
          <div style={{ fontSize:11, color:"rgba(232,232,240,.35)", marginTop:2 }}>{formData.brand} · {formData.eventType} · {formData.budget}</div>
        </div>
        <button className="reset-btn" onClick={()=>{ setStep("form"); setMessages([]); setSearchingWeb(false); }}>← 다시 입력</button>
      </div>

      {/* 행사 요약 배너 */}
      <div style={{ padding:"12px 20px", borderBottom:"1px solid rgba(255,255,255,.04)", background:"rgba(255,122,69,.06)", flexShrink:0 }}>
        <div style={{ fontSize:11.5, color:"rgba(232,232,240,.45)", marginBottom:6 }}>📋 입력된 행사 정보</div>
        <div>
          {[formData.eventType, formData.target, formData.budget, formData.goal].map((t,i)=>(
            <span key={i} className="tag">{t}</span>
          ))}
        </div>
        {formData.memo && <div style={{ marginTop:6, fontSize:12, color:"rgba(232,232,240,.4)" }}>💬 {formData.memo}</div>}
      </div>

      {/* 메시지 */}
      <div style={{ flex:1, overflowY:"auto", padding:"20px", display:"flex", flexDirection:"column", gap:14 }}>

        {/* 초기 로딩 */}
        {loading && messages.length === 0 && (
          <div style={{ display:"flex", flexDirection:"column", gap:10, alignItems:"flex-start" }}>
            <div style={{ display:"flex", alignItems:"flex-end", gap:8 }}>
              <div style={{ width:28, height:28, background:"linear-gradient(135deg,#FF6B35,#FF3F8A)", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13 }}>🎁</div>
              {searchingWeb
                ? <div className="searching-bar"><div className="search-spin" />Instagram · X · YouTube · Google 검색 중...</div>
                : <div className="bubble-bot" style={{ padding:"14px 20px" }}><div style={{ display:"flex", gap:5 }}><div className="dot"/><div className="dot"/><div className="dot"/></div></div>
              }
            </div>
          </div>
        )}

        {messages.map((msg,i)=>(
          <div key={i} style={{ display:"flex", justifyContent:msg.role==="user"?"flex-end":"flex-start", alignItems:"flex-end", gap:8 }}>
            {msg.role==="assistant" && (
              <div style={{ width:28, height:28, background:"linear-gradient(135deg,#FF6B35,#FF3F8A)", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, flexShrink:0 }}>🎁</div>
            )}
            <div className={msg.role==="user"?"bubble-user":"bubble-bot"}>
              {msg.role==="assistant" && (
                <div className="web-badge">🔍 Instagram · X · YouTube · Google 검색 기반 답변</div>
              )}
              {renderText(msg.content)}
            </div>
          </div>
        ))}

        {/* 후속 로딩 */}
        {loading && messages.length > 0 && (
          <div style={{ display:"flex", alignItems:"flex-end", gap:8 }}>
            <div style={{ width:28, height:28, background:"linear-gradient(135deg,#FF6B35,#FF3F8A)", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13 }}>🎁</div>
            {searchingWeb
              ? <div className="searching-bar"><div className="search-spin" />Instagram · X · YouTube · Google 검색 중...</div>
              : <div className="bubble-bot" style={{ padding:"14px 20px" }}><div style={{ display:"flex", gap:5 }}><div className="dot"/><div className="dot"/><div className="dot"/></div></div>
            }
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 입력창 */}
      <div style={{ padding:"14px 20px 20px", borderTop:"1px solid rgba(255,255,255,.06)", background:"rgba(255,255,255,.01)", backdropFilter:"blur(20px)", flexShrink:0 }}>
        <div style={{ display:"flex", gap:10, alignItems:"flex-end" }}>
          <textarea ref={inputRef} className="chat-input" placeholder="더 발전시키거나 다른 방향으로 아이디어를 요청해보세요..." value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleKeyDown} rows={1}
            onInput={e=>{ e.target.style.height="auto"; e.target.style.height=Math.min(e.target.scrollHeight,120)+"px"; }} />
          <button className="send-btn" onClick={sendMessage} disabled={!input.trim()||loading}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
        <div style={{ textAlign:"center", marginTop:8, fontSize:11, color:"rgba(232,232,240,.18)" }}>Enter 전송 · Shift+Enter 줄바꿈</div>
      </div>
    </div>
  );
}
