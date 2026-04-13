"use client";
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const CORE_URL = process.env.NEXT_PUBLIC_CORE_URL || 'http://localhost:8000';

const PERSONA_OPTIONS = [
  { name: 'Default', description: 'Balanced, helpful, concise', prompt: 'You are a helpful, balanced assistant. Be concise and clear.' },
  { name: 'Creative', description: 'Imaginative, exploratory, verbose', prompt: 'You are a creative and imaginative assistant. Explore ideas freely, be expressive and detailed.' },
  { name: 'Technical', description: 'Precise, code-oriented, minimal', prompt: 'You are a precise technical assistant. Focus on code, accuracy, and minimal explanations.' },
  { name: 'Casual', description: 'Friendly, conversational, emoji-friendly', prompt: 'You are a friendly, casual assistant. Be conversational, use emojis, keep things light.' },
  { name: 'Custom', description: 'Write your own', prompt: '' },
];

const AUTOMATION_OPTIONS = [
  { id: 'news', icon: '📰', name: 'Daily news briefing', placeholder: 'What topics interest you?', instruction: (v: string) => `Give me a daily news briefing about: ${v}` },
  { id: 'email', icon: '📧', name: 'Morning email summary', placeholder: 'Which email?', instruction: (v: string) => `Summarize my recent emails${v ? ' from ' + v : ''}` },
  { id: 'calendar', icon: '📅', name: 'Daily calendar preview', placeholder: '', instruction: () => 'Summarize my day ahead from my calendar' },
  { id: 'monitor', icon: '🔔', name: 'Website monitor', placeholder: 'URL to watch', instruction: (v: string) => `Monitor this website for changes and alert me: ${v}` },
];

const MEMORY_OPTIONS = [
  { id: 'honcho', name: 'Deep Memory', description: 'Learns from conversations over time using Honcho. Builds a rich profile of your preferences and context.', icon: '🧠' },
  { id: 'core', name: 'Light Memory', description: 'Basic conversation context within sessions. No long-term learning between conversations.', icon: '💡' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [animating, setAnimating] = useState(false);

  // Step 1: Profile
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [interestInput, setInterestInput] = useState('');
  const [showSocial, setShowSocial] = useState(false);
  const [socialLinks, setSocialLinks] = useState({ twitter: '', github: '', linkedin: '', website: '' });

  // Step 2: Memory
  const [memoryProvider, setMemoryProvider] = useState('honcho');

  // Step 3: Persona
  const [selectedPersona, setSelectedPersona] = useState(0);
  const [customPrompt, setCustomPrompt] = useState('');

  // Step 4: Automation
  const [selectedAutomation, setSelectedAutomation] = useState<string | null>(null);
  const [automationInput, setAutomationInput] = useState('');
  const [delivery, setDelivery] = useState('chat');
  const [scheduleTime, setScheduleTime] = useState('08:00');

  // Step 5: Channels
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramUserId, setTelegramUserId] = useState('');

  const goNext = useCallback(() => {
    setAnimating(true);
    setTimeout(() => { setStep((s) => s + 1); setAnimating(false); }, 200);
  }, []);

  const goBack = useCallback(() => {
    setAnimating(true);
    setTimeout(() => { setStep((s) => s - 1); setAnimating(false); }, 200);
  }, []);

  async function saveProfile() {
    await fetch(`${CORE_URL}/api/onboarding/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName, bio, interests, socialLinks }),
    });
    goNext();
  }

  async function saveMemory() {
    await fetch(`${CORE_URL}/api/onboarding/memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: memoryProvider }),
    });
    goNext();
  }

  async function savePersona() {
    const p = PERSONA_OPTIONS[selectedPersona];
    const prompt = p.name === 'Custom' ? customPrompt : p.prompt;
    await fetch(`${CORE_URL}/api/onboarding/persona`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: p.name, prompt }),
    });
    goNext();
  }

  async function saveAutomation() {
    if (selectedAutomation) {
      const opt = AUTOMATION_OPTIONS.find((a) => a.id === selectedAutomation);
      if (opt) {
        const [h, m] = scheduleTime.split(':');
        const cron = `${m} ${h} * * *`;
        await fetch(`${CORE_URL}/api/onboarding/automation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: opt.name,
            instruction: opt.instruction(automationInput),
            schedule: cron,
            delivery,
          }),
        });
      }
    }
    goNext();
  }

  async function saveChannels() {
    if (telegramToken.trim()) {
      await fetch(`${CORE_URL}/api/onboarding/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegram_bot_token: telegramToken || undefined,
          telegram_user_id: telegramUserId ? Number(telegramUserId) : undefined,
        }),
      });
    }
    goNext();
  }

  async function completeOnboarding() {
    await fetch(`${CORE_URL}/api/onboarding/complete`, { method: 'POST' });
    router.push('/home');
  }

  function addInterest(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && interestInput.trim()) {
      e.preventDefault();
      setInterests((prev) => [...prev, interestInput.trim()]);
      setInterestInput('');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] text-[var(--fg)]">
      <div className={`w-full max-w-xl mx-4 transition-opacity duration-200 ${animating ? 'opacity-0' : 'opacity-100'}`}>

        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className="text-center space-y-6 animate-fadeIn">
            <div className="text-6xl font-bold tracking-tight">Lex</div>
            <h1 className="text-2xl font-semibold">Welcome to Lex</h1>
            <p className="opacity-70">Your personal AI cloud computer</p>
            <button onClick={goNext} className="px-6 py-2.5 rounded-lg bg-white text-black font-medium hover:bg-white/90 transition-colors">
              Get Started
            </button>
          </div>
        )}

        {/* Step 1: Profile */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-semibold">Tell Lex about yourself</h2>
              <p className="text-sm opacity-60 mt-1">This helps Lex personalize responses for you</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm opacity-80 block mb-1">Name</label>
                <input value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="What should Lex call you?"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-white/30 outline-none transition" />
              </div>
              <div>
                <label className="text-sm opacity-80 block mb-1">What do you do?</label>
                <textarea value={bio} onChange={(e) => setBio(e.target.value)}
                  placeholder="e.g. Software engineer working on AI products..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-white/30 outline-none transition resize-none" />
              </div>
              <div>
                <label className="text-sm opacity-80 block mb-1">Interests / focus areas</label>
                <input value={interestInput} onChange={(e) => setInterestInput(e.target.value)}
                  onKeyDown={addInterest}
                  placeholder="Type + Enter to add tags"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-white/30 outline-none transition" />
                {interests.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {interests.map((tag, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-full bg-white/10 text-sm flex items-center gap-1">
                        {tag}
                        <button onClick={() => setInterests((p) => p.filter((_, j) => j !== i))} className="opacity-60 hover:opacity-100">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <button onClick={() => setShowSocial(!showSocial)} className="text-sm opacity-60 hover:opacity-100 transition">
                  {showSocial ? '▾' : '▸'} Social links (optional)
                </button>
                {showSocial && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <input value={socialLinks.twitter} onChange={(e) => setSocialLinks((s) => ({ ...s, twitter: e.target.value }))} placeholder="Twitter" className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm outline-none" />
                    <input value={socialLinks.github} onChange={(e) => setSocialLinks((s) => ({ ...s, github: e.target.value }))} placeholder="GitHub" className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm outline-none" />
                    <input value={socialLinks.linkedin} onChange={(e) => setSocialLinks((s) => ({ ...s, linkedin: e.target.value }))} placeholder="LinkedIn" className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm outline-none" />
                    <input value={socialLinks.website} onChange={(e) => setSocialLinks((s) => ({ ...s, website: e.target.value }))} placeholder="Website" className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm outline-none" />
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-between pt-2">
              <button onClick={goBack} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 transition">Back</button>
              <button onClick={saveProfile} className="px-6 py-2 rounded-lg bg-white text-black font-medium hover:bg-white/90 transition">Continue</button>
            </div>
          </div>
        )}

        {/* Step 2: Memory Provider */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-semibold">Choose your memory mode</h2>
              <p className="text-sm opacity-60 mt-1">This determines how Lex remembers your conversations</p>
            </div>
            <div className="space-y-3">
              {MEMORY_OPTIONS.map((opt) => (
                <button key={opt.id} onClick={() => setMemoryProvider(opt.id)}
                  className={`w-full text-left p-4 rounded-lg border transition ${memoryProvider === opt.id ? 'border-white bg-white/10' : 'border-white/10 hover:border-white/30'}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{opt.icon}</span>
                    <div>
                      <div className="font-medium">{opt.name}</div>
                      <div className="text-sm opacity-60 mt-0.5">{opt.description}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex justify-between pt-2">
              <button onClick={goBack} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 transition">Back</button>
              <button onClick={saveMemory} className="px-6 py-2 rounded-lg bg-white text-black font-medium hover:bg-white/90 transition">Continue</button>
            </div>
          </div>
        )}

        {/* Step 3: Persona */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-semibold">Choose your AI's personality</h2>
              <p className="text-sm opacity-60 mt-1">You can change this anytime in Settings</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {PERSONA_OPTIONS.map((p, i) => (
                <button key={p.name} onClick={() => setSelectedPersona(i)}
                  className={`text-left p-3 rounded-lg border transition ${selectedPersona === i ? 'border-white bg-white/10' : 'border-white/10 hover:border-white/30'}`}>
                  <div className="font-medium text-sm">{p.name}</div>
                  <div className="text-xs opacity-60 mt-1">{p.description}</div>
                </button>
              ))}
            </div>
            {PERSONA_OPTIONS[selectedPersona].name === 'Custom' && (
              <textarea value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Describe how you want your AI to behave..."
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-white/30 outline-none resize-none" />
            )}
            <div className="flex justify-between pt-2">
              <button onClick={goBack} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 transition">Back</button>
              <button onClick={savePersona} className="px-6 py-2 rounded-lg bg-white text-black font-medium hover:bg-white/90 transition">Continue</button>
            </div>
          </div>
        )}

        {/* Step 4: First Automation */}
        {step === 4 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-semibold">Set up your first automation</h2>
              <p className="text-sm opacity-60 mt-1">Lex can work for you even when you're away</p>
            </div>
            <div className="space-y-2">
              {AUTOMATION_OPTIONS.map((opt) => (
                <button key={opt.id} onClick={() => setSelectedAutomation(selectedAutomation === opt.id ? null : opt.id)}
                  className={`w-full text-left p-3 rounded-lg border transition ${selectedAutomation === opt.id ? 'border-white bg-white/10' : 'border-white/10 hover:border-white/30'}`}>
                  <span className="mr-2">{opt.icon}</span>
                  <span className="font-medium text-sm">{opt.name}</span>
                </button>
              ))}
            </div>
            {selectedAutomation && (
              <div className="space-y-3 p-3 rounded-lg bg-white/5 border border-white/10">
                {AUTOMATION_OPTIONS.find((a) => a.id === selectedAutomation)?.placeholder && (
                  <input value={automationInput} onChange={(e) => setAutomationInput(e.target.value)}
                    placeholder={AUTOMATION_OPTIONS.find((a) => a.id === selectedAutomation)?.placeholder}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 outline-none text-sm" />
                )}
                <div className="flex gap-3 items-center">
                  <label className="text-xs opacity-60">Deliver via:</label>
                  {['chat', 'email', 'telegram'].map((d) => (
                    <button key={d} onClick={() => setDelivery(d)}
                      className={`px-2 py-1 text-xs rounded ${delivery === d ? 'bg-white/20' : 'bg-white/5'}`}>
                      {d.charAt(0).toUpperCase() + d.slice(1)}
                    </button>
                  ))}
                </div>
                <div className="flex gap-3 items-center">
                  <label className="text-xs opacity-60">Time:</label>
                  <input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)}
                    className="px-2 py-1 text-sm rounded bg-white/5 border border-white/10 outline-none" />
                </div>
              </div>
            )}
            <div className="flex justify-between pt-2">
              <button onClick={goBack} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 transition">Back</button>
              <div className="flex gap-2">
                {!selectedAutomation && (
                  <button onClick={goNext} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 transition text-sm">Skip for now</button>
                )}
                <button onClick={saveAutomation} className="px-6 py-2 rounded-lg bg-white text-black font-medium hover:bg-white/90 transition">
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Channels */}
        {step === 5 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-semibold">Connect channels</h2>
              <p className="text-sm opacity-60 mt-1">Access Lex from anywhere</p>
            </div>
            <div className="space-y-3">
              <div className="p-4 rounded-lg border border-white/10 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-lg">✈️</span>
                  <div className="flex-1">
                    <div className="font-medium text-sm">Telegram</div>
                    <div className="text-xs opacity-60">Chat with your AI via Telegram</div>
                  </div>
                </div>
                <div className="space-y-2 ml-8">
                  <input value={telegramToken} onChange={(e) => setTelegramToken(e.target.value)}
                    placeholder="Bot token (from @BotFather)"
                    className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm outline-none" />
                  <input value={telegramUserId} onChange={(e) => setTelegramUserId(e.target.value)}
                    placeholder="Your Telegram user ID (optional)"
                    className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm outline-none" />
                </div>
              </div>
              <div className="p-3 rounded-lg border border-white/10">
                <div className="flex items-center gap-3">
                  <span className="text-lg">✉️</span>
                  <div className="flex-1">
                    <div className="font-medium text-sm">Email</div>
                    <div className="text-xs opacity-60">Send emails to your AI and get replies</div>
                  </div>
                  <span className="px-2 py-1 text-xs rounded bg-white/10 opacity-60">Configure in Settings</span>
                </div>
              </div>
              <div className="p-3 rounded-lg border border-white/10">
                <div className="flex items-center gap-3">
                  <span className="text-lg">🎮</span>
                  <div className="flex-1">
                    <div className="font-medium text-sm">Discord</div>
                    <div className="text-xs opacity-60">Chat with your AI via Discord DMs</div>
                  </div>
                  <span className="px-2 py-1 text-xs rounded bg-white/10 opacity-60">Configure in Settings</span>
                </div>
              </div>
            </div>
            <div className="flex justify-between pt-2">
              <button onClick={goBack} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 transition">Back</button>
              <div className="flex gap-2">
                {!telegramToken && (
                  <button onClick={goNext} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 transition text-sm">Skip</button>
                )}
                <button onClick={saveChannels} className="px-6 py-2 rounded-lg bg-white text-black font-medium hover:bg-white/90 transition">
                  {telegramToken ? 'Save & Continue' : 'Continue'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 6: Ready! */}
        {step === 6 && (
          <div className="text-center space-y-6">
            <div className="text-5xl">🖥️</div>
            <h2 className="text-2xl font-semibold">Your computer is ready!</h2>
            <p className="opacity-60 text-sm">Everything is set up. You can always adjust settings later.</p>
            <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
              <button onClick={() => { completeOnboarding(); }} className="p-3 rounded-lg bg-white text-black font-medium hover:bg-white/90 transition">
                💬 Start Chatting
              </button>
              <button onClick={async () => { await fetch(`${CORE_URL}/api/onboarding/complete`, { method: 'POST' }); router.push('/files'); }} className="p-3 rounded-lg bg-white/10 hover:bg-white/15 transition">
                📁 Upload Files
              </button>
              <button onClick={async () => { await fetch(`${CORE_URL}/api/onboarding/complete`, { method: 'POST' }); router.push('/hosting'); }} className="p-3 rounded-lg bg-white/10 hover:bg-white/15 transition">
                🌐 Build a Site
              </button>
              <button onClick={async () => { await fetch(`${CORE_URL}/api/onboarding/complete`, { method: 'POST' }); router.push('/settings'); }} className="p-3 rounded-lg bg-white/10 hover:bg-white/15 transition">
                ⚙️ Explore Settings
              </button>
            </div>
          </div>
        )}

        {/* Step indicator */}
        {step > 0 && step < 6 && (
          <div className="flex justify-center gap-1.5 mt-8">
            {[1, 2, 3, 4, 5].map((s) => (
              <div key={s} className={`w-2 h-2 rounded-full transition ${step >= s ? 'bg-white' : 'bg-white/20'}`} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
