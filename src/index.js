export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS Headers for Web Fetch API
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname === '/web' || url.pathname === '/web/') {
      const chatId = url.searchParams.get('chat_id') || '';
      return new Response(getWebHTML(chatId), {
        headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders }
      });
    }

    // NEW: Web Sandbox AI Vocabulary API Endpoint
    if (url.pathname === '/api/vocab') {
      const word = url.searchParams.get('word');
      if (!word) {
        return new Response(JSON.stringify({ error: 'Missing word parameter' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const vocabResult = await fetchVocabularyInfo(word, env);
      return new Response(JSON.stringify({ result: vocabResult }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if (url.pathname === '/api/processes') {
      const chatId = url.searchParams.get('chat_id');
      if (!chatId) return new Response(JSON.stringify({ error: 'Missing chat_id' }), { status: 400, headers: corsHeaders });
      
      const listKey = `processes_${chatId}`;

      if (request.method === 'GET') {
        let processes = await env.BOT_KV.get(listKey, { type: 'json' }) || [];
        return new Response(JSON.stringify(processes), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      if (request.method === 'POST') {
        const body = await request.json();
        await env.BOT_KV.put(listKey, JSON.stringify(body.processes || []));
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    if (request.method === 'POST') {
      try {
        const update = await request.json();
        if (update.message) {
          const message = update.message;
          const chatId = message.chat.id;
          const chatType = message.chat.type;

          if (chatType !== 'group' && chatType !== 'supergroup') {
            if (message.text) {
              await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, "❌ ဒီ Bot ကို Telegram Group များတွင်သာ အသုံးပြုနိုင်ပါသည်။");
            }
            return new Response('OK');
          }

          if (message.from) {
            const userId = message.from.id;
            const firstName = escapeHTML(message.from.first_name || "User");
            const membersKey = `members_${chatId}`;
            let membersData = await env.BOT_KV.get(membersKey, { type: "json" }) || {};
            membersData[userId] = firstName;
            await env.BOT_KV.put(membersKey, JSON.stringify(membersData));
          }

          if (!message.text) return new Response('OK');
          const rawText = message.text.trim();
          const workerUrl = `${url.protocol}//${url.host}`;
          const webDirectLink = `${workerUrl}/web?chat_id=${chatId}`;

          ctx.waitUntil(setupBotCommands(env.TELEGRAM_BOT_TOKEN));

          const commandText = rawText.split('@')[0].trim();

          // 1. Regular Bot Commands
          if (commandText === '/start') {
            const msg = `👋 <b>TTPT Reminder Bot မှ ကြိုဆိုပါသည်။</b>\n\n` +
                        `Process များစွာကို စီမံခန့်ခွဲရန် Dashboard ကို အသုံးပြုပါ:\n` +
                        `🌐 ${webDirectLink}`;
            await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, msg);
            return new Response('OK');
          }
          else if (commandText === '/help') {
            const helpText = `📖 <b>TTPT Reminder Bot ကူညီမှုစာမျက်နှာ</b>\n\n` +
                             `• /web - Dashboard ဖွင့်ရန်\n` +
                             `• /menu - လက်ရှိ Process များနှင့် Left Time ကြည့်ရန်\n` +
                             `• /listen [word] - အင်္ဂလိပ်စာလုံး သို့မဟုတ် စာကြောင်းများ၏ အသံထွက်ကို နားထောင်ရန် 🔊\n` +
                             `• /vocab - အင်္ဂလိပ်ဝေါဟာရများ ရှာဖွေရန်\n` +
                             `• Group ထဲတွင် Bot Username (@ttpt_reminderbot word) ကို Mention ပြီး အင်္ဂလိပ်ဝေါဟာရများ ရှာဖွေနိုင်ပါသည်။`;
            await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, helpText);
            return new Response('OK');
          }
          else if (commandText === '/menu') {
            const listKey = `processes_${chatId}`;
            let processes = await env.BOT_KV.get(listKey, { type: 'json' }) || [];
            
            if (processes.length === 0) {
              const noDataMsg = `⚠️ လက်ရှိ Active ဖြစ်နေသော Process များ မရှိသေးပါ။ Dashboard တွင် အသစ်ထည့်သွင်းပါ:\n🌐 ${webDirectLink}`;
              await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, noDataMsg);
              return new Response('OK');
            }

            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            let msg = `📊 <b>Active Process List</b>\n\n`;

            for (const p of processes) {
              const targetDate = new Date(p.targetDate);
              const targetClean = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
              const diffDays = Math.ceil((targetClean - today) / (1000 * 60 * 60 * 24));
              const leftText = diffDays >= 0 ? `${diffDays} ရက် လိုပါသေးသည်` : `ရက်ရောက်ရှိသွားပါပြီ`;

              let hwList = "";
              for (const [sub, task] of Object.entries(p.homework || {})) {
                hwList += `  • <b>${sub.toUpperCase()}:</b> ${escapeHTML(task || 'No Homework')}\n`;
              }

              msg += `📌 <b>${escapeHTML(p.title)}</b>\n` +
                     `⏳ Target: ${p.targetDate} [ Left: <b>${leftText}</b> ]\n` +
                     `⏰ Remind: ${p.remindTimes.join(', ')}\n` +
                     `📚 Homework:\n${hwList}\n------------------------\n`;
            }

            msg += `🌐 <a href="${webDirectLink}">Manage via Web Dashboard</a>`;
            await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, msg);
            return new Response('OK');
          }
          else if (commandText === '/web') {
            const msg = `🌐 <b>TTPT Reminder Dashboard</b>\n\nအောက်ပါ Link ကို နှိပ်ပြီး Process များကို ပြင်ဆင်ပါ:\n${webDirectLink}`;
            await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, msg);
            return new Response('OK');
          }

          // Text-To-Speech Pronunciation Command (/listen [word])
          if (rawText.startsWith('/listen')) {
            const textToSpeech = rawText.replace(/\/listen(@\w+)?/i, '').trim();
            if (!textToSpeech) {
              await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, "⚠️ ကျေးဇူးပြု၍ အသံထွက် နားထောင်လိုသော စာလုံးကို ထည့်သွင်းပါ:\nဥပမာ - <code>/listen resilient</code>");
              return new Response('OK');
            }

            const audioUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(textToSpeech)}&tl=en&client=tw-ob`;
            const caption = `🔊 <b>Pronunciation:</b> <code>${escapeHTML(textToSpeech)}</code>`;
            await sendVoiceMessage(env.TELEGRAM_BOT_TOKEN, chatId, audioUrl, caption);
            return new Response('OK');
          }

          // Vocabulary AI Mention Handler
          const botUsername = "@" + (env.BOT_USERNAME || "ttpt_reminderbot").toLowerCase();
          const lowerRawText = rawText.toLowerCase();

          if (lowerRawText.includes(botUsername) || lowerRawText.startsWith('/vocab')) {
            const regex = new RegExp(`(${botUsername}|/vocab)`, 'gi');
            const queryWord = rawText.replace(regex, '').trim();

            if (queryWord.length > 0 && !queryWord.startsWith('/')) {
              const vocabResult = await fetchVocabularyInfo(queryWord, env);
              await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, vocabResult);
              return new Response('OK');
            }
          }
        }
      } catch (e) {
        console.error(e);
      }
      return new Response('OK', { status: 200 });
    }

    return new Response('TTPT Reminder Bot is Active!', { status: 200 });
  },

  async scheduled(event, env, ctx) {
    const now = new Date();
    const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
    const myanmarTime = new Date(utcMs + (390 * 60000));
    
    const currentHour = myanmarTime.getHours();
    const currentMinute = myanmarTime.getMinutes();
    const currentTotalMinutes = currentHour * 60 + currentMinute;

    const today = new Date(myanmarTime.getFullYear(), myanmarTime.getMonth(), myanmarTime.getDate());
    const currentDayOfWeek = myanmarTime.getDay();

    const list = await env.BOT_KV.list();

    for (const key of list.keys) {
      if (key.name.startsWith('processes_')) {
        const chatId = key.name.replace('processes_', '');
        let processes = await env.BOT_KV.get(key.name, { type: 'json' }) || [];
        if (!Array.isArray(processes) || processes.length === 0) continue;

        let updated = false;

        for (const p of processes) {
          if (!p.remindTimes || !p.targetDate) continue;

          if (currentDayOfWeek === 1 && currentHour === 0 && currentMinute === 0 && p.lastResetDay !== 1) {
            p.homework = { myan: "", eng: "", math: "", chem: "", phy: "", bio_eco: "" };
            p.lastResetDay = 1;
            updated = true;
          } else if (currentDayOfWeek !== 1) {
            p.lastResetDay = 0;
          }

          let shouldTrigger = false;
          for (const timeStr of p.remindTimes) {
            const [h, m] = timeStr.split(':').map(Number);
            if (!isNaN(h) && !isNaN(m)) {
              const targetTotalMinutes = h * 60 + m;
              if (currentTotalMinutes === targetTotalMinutes) {
                shouldTrigger = true;
                break;
              }
            }
          }

          if (shouldTrigger) {
            const targetDate = new Date(p.targetDate);
            const targetClean = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
            const diffDays = Math.ceil((targetClean - today) / (1000 * 60 * 60 * 24));

            if (diffDays < 0) continue;

            const negativeMoti = await fetchFreeAiMotivation(p.title, diffDays, env);

            const membersKey = `members_${chatId}`;
            let membersData = await env.BOT_KV.get(membersKey, { type: "json" }) || {};
            let mentions = [];
            for (const [userId, name] of Object.entries(membersData)) {
              mentions.push(`<a href="tg://user?id=${userId}">${escapeHTML(name)}</a>`);
            }
            let mentionText = mentions.length > 0 ? mentions.join(' ') : "@everyone";

            let hwText = "";
            const subjects = {
              myan: "Myanmar",
              eng: "English",
              math: "Mathematics",
              chem: "Chemistry",
              phy: "Physics",
              bio_eco: "Bio/Eco"
            };

            for (const [subKey, subName] of Object.entries(subjects)) {
              const task = p.homework ? p.homework[subKey] : "";
              hwText += `• <b>${subName}:</b> ${task && task.trim() !== "" ? escapeHTML(task) : "No Homework"}\n`;
            }

            let message = `📌 <b>${escapeHTML(p.title)}</b>\n` +
                          `⏳ Target Date: ${p.targetDate} [ Left Time: <b>${diffDays} ရက်</b> ]\n\n` +
                          `🔥 <b>Motivation:</b>\n` +
                          `"${escapeHTML(negativeMoti)}"\n\n` +
                          `📚 <b>Weekly Homework List:</b>\n` +
                          `${hwText}\n` +
                          `📢 ${mentionText}`;

            await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, message);
          }
        }

        if (updated) {
          await env.BOT_KV.put(key.name, JSON.stringify(processes));
        }
      }
    }
  }
};

function escapeHTML(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function setupBotCommands(token) {
  const url = `https://api.telegram.org/bot${token}/setMyCommands`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commands: [
          { command: "menu", description: "လက်ရှိ Process များနှင့် Left Time ကြည့်ရန်" },
          { command: "listen", description: "အင်္ဂလိပ်စာလုံး အသံထွက် နားထောင်ရန်" },
          { command: "web", description: "Web Dashboard ဖွင့်ရန်" },
          { command: "help", description: "ကူညီမှု စာမျက်နှာ ကြည့်ရန်" },
          { command: "vocab", description: "အင်္ဂလိပ်ဝေါဟာရများ ရှာဖွေရန်" }
        ]
      })
    });
  } catch (err) {
    console.error("Failed to set bot commands:", err);
  }
}

async function fetchVocabularyInfo(word, env) {
  const prompt = `Provide linguistic details for the English word '${word}' strictly in the following format:

Form: [List the actual derived words for each Part of Speech for this word family. Format as: word(noun), word(verb), word/word(adjective), word(adverb). If a specific part of speech like adverb or adjective does not exist for this word, omit it entirely. Example for 'stress': stress (noun), stress (verb), stressful/stressed (adjective)]
Trans: [Myanmar translation]
Synonyms: [same meaning words in English]
Examples:
1. [First sentence]
2. [Second sentence]
3. [Third sentence]

CRITICAL REQUIREMENT FOR EXAMPLES: In every example sentence, you MUST format the target word '${word}' (or its derived form used) using BOTH HTML bold and underline tags like: <b><u>${word}</u></b>.`;

  if (env && env.COZE_API_TOKEN && env.COZE_BOT_ID) {
    try {
      const cozeRes = await fetch("https://api.coze.com/open_api/v2/chat", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.COZE_API_TOKEN}`,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          bot_id: env.COZE_BOT_ID,
          user: "ttpt_vocab_user",
          query: prompt,
          stream: false
        })
      });
      const cozeText = await cozeRes.text();
      let cozeData;
      try {
        cozeData = JSON.parse(cozeText);
      } catch (e) {}

      if (cozeData && cozeData.messages && cozeData.messages.length > 0) {
        const replyMsg = cozeData.messages.find(m => m.role === 'assistant');
        if (replyMsg && replyMsg.content && replyMsg.content.trim().length > 2) {
          return `📖 <b>Vocabulary Lookup:</b> <code>${escapeHTML(word)}</code>\n\n${replyMsg.content.trim()}`;
        }
      }
    } catch (err) {
      console.error("Coze Vocab Error:", err);
    }
  }

  return `❌ မိတ်ဆွေ တောင်းဆိုထားသော '${escapeHTML(word)}' အတွက် အချက်အလက် ရှာမတွေ့ပါ။ ကျေးဇူးပြု၍ စာလုံးပေါင်း စစ်ဆေးပြီး ထပ်ကြိုးစားပါ။`;
}

async function fetchFreeAiMotivation(title, daysLeft, env) {
  const prompt = `Write ONLY four short, inspiring, and encouraging motivational sentences in Burmese language for students preparing for '${title}' with ${daysLeft} days left . Keep it uplifting, reminding them of their potential and goals, keeping it under 30 words with no emojis. Do not add any extra text or formatting. motivation should be in Myanmar language. motivation should be short and encouraging and uplifting mind and heart.`;

  if (env && env.COZE_API_TOKEN && env.COZE_BOT_ID) {
    try {
      const cozeRes = await fetch("https://api.coze.com/open_api/v2/chat", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.COZE_API_TOKEN}`,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          bot_id: env.COZE_BOT_ID,
          user: "ttpt_user",
          query: prompt,
          stream: false
        })
      });
      const cozeText = await cozeRes.text();
      let cozeData;
      try {
        cozeData = JSON.parse(cozeText);
      } catch (e) {}

      if (cozeData && cozeData.messages && cozeData.messages.length > 0) {
        const replyMsg = cozeData.messages.find(m => m.role === 'assistant');
        if (replyMsg && replyMsg.content && replyMsg.content.trim().length > 2) {
          return replyMsg.content.trim();
        }
      }
    } catch (err) {
      console.error("Coze API Error Catch:", err);
    }
  }

  const localFallbacks = [
    `(${title}) ဖြေဖို့ ${daysLeft} ရက်ပဲ လိုတော့တယ်၊ အလကားထိုင်မနေနဲ့တော့။`,
    `အချိန်တွေ ကုန်နေပြီ၊ မင်းရဲ့ ပြိုင်ဘက်တွေ ရှေ့ရောက်နေပြီ။`,
    `ဒီအတိုင်း ပျင်းနေဦးမယ်ဆိုရင် စာမေးပွဲမှာ ကျရှုံးဖို့ သေချာတယ်။`,
    `မင်းရဲ့ အိမ်မှာ စာမေးပွဲကို မျှော်လင့်ပြီး ပြောပြောနေတာကြားရတာ နားရောက်သွားလား?`,
  ];
  return localFallbacks[Math.floor(Math.random() * localFallbacks.length)];
}

async function sendMessage(token, chatId, text) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
      })
    });
    const result = await res.json();
    console.log("Telegram API Response:", JSON.stringify(result));
  } catch (err) {
    console.error("Failed to send message:", err);
  }
}

async function sendVoiceMessage(token, chatId, audioUrl, caption) {
  const url = `https://api.telegram.org/bot${token}/sendVoice`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        voice: audioUrl,
        caption: caption,
        parse_mode: 'HTML'
      })
    });
    const result = await res.json();
    console.log("Telegram API Voice Response:", JSON.stringify(result));
  } catch (err) {
    console.error("Failed to send voice message:", err);
  }
}

function getWebHTML(chatId) {
  return `<!DOCTYPE html>
<html lang="my">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TTPT Reminder Dashboard</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <style>
    body { background-color: #e2e8f0; color: #1e293b; font-family: system-ui, -apple-system, sans-serif; }
    .neu-card { background: #e2e8f0; box-shadow: 9px 9px 16px #cbd5e1, -9px -9px 16px #ffffff; border-radius: 1rem; }
    .neu-inset { background: #e2e8f0; box-shadow: inset 4px 4px 8px #cbd5e1, inset -4px -4px 8px #ffffff; }
    .neu-button { background: #e2e8f0; box-shadow: 5px 5px 10px #cbd5e1, -5px -5px 10px #ffffff; transition: all 0.2s; }
    .neu-button:active { box-shadow: inset 3px 3px 6px #cbd5e1, inset -3px -3px 6px #ffffff; }
  </style>
</head>
<body class="p-4 max-w-xl mx-auto pb-20">
  <div class="neu-card p-6 mb-6">
    <h1 class="text-xl font-extrabold text-center text-slate-700 mb-1">TTPT Reminder Studio</h1>
    <p class="text-xs text-center text-slate-500 mb-4">Multi-Process & Homework Manager</p>

    <div class="mb-4 bg-[#e2e8f0] p-3 rounded-xl neu-inset">
      <label class="block text-xs font-bold text-slate-600 mb-1">Telegram Group Chat ID</label>
      <div class="flex gap-2">
        <input type="text" id="chatIdInput" class="w-full bg-transparent border-none p-2 text-xs text-slate-800 focus:outline-none" placeholder="-100xxxxxxxxxx">
        <button onclick="loadProcesses()" class="neu-button px-4 py-1.5 rounded-lg text-xs font-bold text-indigo-600">Load</button>
      </div>
    </div>
  </div>

  <div class="flex justify-between items-center mb-4 px-2">
    <h2 class="text-sm font-bold text-slate-700">Active Processes</h2>
    <button onclick="addNewProcess()" class="neu-button px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-600">+ Add Process</button>
  </div>

  <div id="loading" class="text-center py-8 text-slate-500">Loading Processes...</div>
  <div id="processContainer" class="space-y-6"></div>

  <div id="saveBar" class="hidden fixed bottom-0 left-0 right-0 p-4 bg-[#e2e8f0]/90 backdrop-blur shadow-lg border-t border-slate-300 text-center">
    <button onclick="saveAllProcesses()" class="max-w-md mx-auto w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl shadow-md transition-all text-sm">
      Save All Changes
    </button>
  </div>

  <script>
    const tg = window.Telegram?.WebApp;
    if (tg) tg.expand();

    let currentChatId = "${chatId}";
    const urlParams = new URLSearchParams(window.location.search);
    if (!currentChatId) {
      currentChatId = urlParams.get('chat_id') || tg?.initDataUnsafe?.chat?.id || '';
    }
    document.getElementById('chatIdInput').value = currentChatId;

    let processes = [];

    function loadProcesses() {
      const inputVal = document.getElementById('chatIdInput').value.trim();
      if (!inputVal) {
        alert('Chat ID ထည့်သွင်းပေးပါ။');
        return;
      }
      currentChatId = inputVal;
      fetchData();
    }

    async function fetchData() {
      if (!currentChatId) {
        document.getElementById('loading').innerText = "⚠️ ကျေးဇူးပြု၍ Chat ID ထည့်သွင်းပြီး Load ကိုနှိပ်ပါ။";
        return;
      }
      document.getElementById('loading').innerText = "Loading...";
      try {
        const res = await fetch('/api/processes?chat_id=' + currentChatId);
        processes = await res.json();
        renderProcesses();
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('saveBar').classList.remove('hidden');
      } catch (err) {
        document.getElementById('loading').innerText = "Data ရယူ၍ မရပါ။";
      }
    }

    function renderProcesses() {
      const container = document.getElementById('processContainer');
      container.innerHTML = '';

      if (processes.length === 0) {
        container.innerHTML = '<p class="text-center text-xs text-slate-500 py-4">Process များ မရှိသေးပါ။ + Add Process ဖြင့် စတင်ပါ။</p>';
        return;
      }

      processes.forEach((p, index) => {
        const card = document.createElement('div');
        card.className = 'neu-card p-5 space-y-3 relative';
        card.innerHTML = \`
          <div class="flex justify-between items-center mb-2">
            <span class="text-xs font-bold text-indigo-600">Process #\${index + 1}</span>
            <button onclick="deleteProcess(\${index})" class="text-rose-500 font-bold text-xs px-2 py-1 neu-button rounded">Delete</button>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1">Title</label>
            <input type="text" value="\${p.title || ''}" onchange="updateField(\${index}, 'title', this.value)" class="w-full bg-transparent neu-inset rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none" placeholder="Final Exam">
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">Target Date</label>
              <input type="date" value="\${p.targetDate || ''}" onchange="updateField(\${index}, 'targetDate', this.value)" class="w-full bg-transparent neu-inset rounded-lg p-2 text-xs text-slate-800 focus:outline-none">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">Remind Times (Comma sep)</label>
              <input type="text" value="\${p.remindTimes ? p.remindTimes.join(', ') : ''}" onchange="updateTimes(\${index}, this.value)" class="w-full bg-transparent neu-inset rounded-lg p-2 text-xs text-slate-800 focus:outline-none" placeholder="07:00, 13:00, 19:00">
            </div>
          </div>
          <div class="mt-3">
            <label class="block text-xs font-bold text-slate-600 mb-2">📚 Weekly Homework List</label>
            <div class="grid grid-cols-2 gap-2 text-xs">
              <div><span class="text-[10px] text-slate-500">Myanmar</span><input type="text" value="\${p.homework?.myan || ''}" onchange="updateHw(\${index}, 'myan', this.value)" class="w-full bg-transparent neu-inset rounded p-1.5 text-slate-800"></div>
              <div><span class="text-[10px] text-slate-500">English</span><input type="text" value="\${p.homework?.eng || ''}" onchange="updateHw(\${index}, 'eng', this.value)" class="w-full bg-transparent neu-inset rounded p-1.5 text-slate-800"></div>
              <div><span class="text-[10px] text-slate-500">Mathematics</span><input type="text" value="\${p.homework?.math || ''}" onchange="updateHw(\${index}, 'math', this.value)" class="w-full bg-transparent neu-inset rounded p-1.5 text-slate-800"></div>
              <div><span class="text-[10px] text-slate-500">Chemistry</span><input type="text" value="\${p.homework?.chem || ''}" onchange="updateHw(\${index}, 'chem', this.value)" class="w-full bg-transparent neu-inset rounded p-1.5 text-slate-800"></div>
              <div><span class="text-[10px] text-slate-500">Physics</span><input type="text" value="\${p.homework?.phy || ''}" onchange="updateHw(\${index}, 'phy', this.value)" class="w-full bg-transparent neu-inset rounded p-1.5 text-slate-800"></div>
              <div><span class="text-[10px] text-slate-500">Bio/Eco</span><input type="text" value="\${p.homework?.bio_eco || ''}" onchange="updateHw(\${index}, 'bio_eco', this.value)" class="w-full bg-transparent neu-inset rounded p-1.5 text-slate-800"></div>
            </div>
          </div>
        \`;
        container.appendChild(card);
      });
    }

    function addNewProcess() {
      processes.push({
        title: "New Exam",
        targetDate: "2027-03-05",
        remindTimes: ["07:00", "13:00", "19:00"],
        homework: { myan: "", eng: "", math: "", chem: "", phy: "", bio_eco: "" }
      });
      renderProcesses();
    }

    function deleteProcess(index) {
      if (confirm('ဤ Process ကို ဖျက်ရန် သေချာပါသလား?')) {
        processes.splice(index, 1);
        renderProcesses();
      }
    }

    function updateField(index, field, val) {
      processes.splice(index, 1, { ...processes[index], [field]: val });
    }

    function updateTimes(index, val) {
      processes[index].remindTimes = val.split(',').map(t => t.trim());
    }

    function updateHw(index, sub, val) {
      if (!processes[index].homework) processes[index].homework = {};
      processes[index].homework[sub] = val;
    }

    async function saveAllProcesses() {
      if (!currentChatId) {
        alert('Chat ID မရှိပါ။');
        return;
      }
      try {
        const res = await fetch('/api/processes?chat_id=' + currentChatId, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ processes })
        });
        if (res.ok) {
          alert('✅ အပြောင်းအလဲများ အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။');
          if (tg) tg.close();
        }
      } catch (err) {
        alert('❌ သိမ်းဆည်းရာတွင် အမှားအယွင်း ရှိခဲ့ပါသည်။');
      }
    }

    if (currentChatId) {
      fetchData();
    } else {
      document.getElementById('loading').innerText = "⚠️ ကျေးဇူးပြု၍ အထက်တွင် Chat ID ထည့်သွင်းပေးပါ။";
    }
  </script>
</body>
</html>`;
}