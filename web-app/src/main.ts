import './style.css'
import { WebSocketManager } from './websocket'
import { CryptoUtils } from './crypto'

interface Message {
  id: string
  senderId: string // Service ID
  receiverId: string // Service ID
  text: string
  timestamp: number
}

// Global State
const state = {
  currentScreen: 'splash',
  userRole: 'Officer',
  currentUserId: '', // Logged in Service ID
  userName: '',
  token: '',
  familyBindId: '', // Added for family login
  serverIp: '127.0.0.1',
  activeChatContactId: '', // Always Service ID
  activeChatContactName: '',
  officialContacts: [] as { name: string, id: string }[],
  familyContacts: [] as { name: string, id: string }[],
  messages: [] as Message[],
  allUsers: [] as any[], // Dynamic fetch
  
  // Registration Inputs
  registration: {
    name: '',
    serviceId: '',
    rank: '',
    unit: '',
    relation: '',
    soldierId: ''
  },
  
  // Security State
  showRedAlert: false,
  errorMessage: '',
  isLockdown: false,
  isEmergency: false,
  isBiometricScanning: false,
  familyBg: localStorage.getItem('family_bg_uri') || ''
}

const wsManager = new WebSocketManager()

// Load persistence
const savedMessages = localStorage.getItem('kavach_messages')
if (savedMessages) state.messages = JSON.parse(savedMessages)

function saveMessages() {
    localStorage.setItem('kavach_messages', JSON.stringify(state.messages))
}

async function fetchDirectory(): Promise<boolean> {
    try {
        const response = await fetch(`http://${state.serverIp}:3000/api/v1/users/directory`);
        if (!response.ok) throw new Error('Failed to fetch directory');
        state.allUsers = await response.json();
        return true;
    } catch (e) {
        console.error(e);
        showToast('NETWORK ERROR', 'Could not connect to directory server.', 'error');
        return false;
    }
}

/**
 * Toast Notification System
 */
function showToast(title: string, message: string, type: 'info' | 'error' | 'success' = 'info') {
    let container = document.getElementById('toast-container')
    if (!container) {
        container = document.createElement('div')
        container.id = 'toast-container'
        container.style.position = 'fixed'
        container.style.top = '20px'
        container.style.right = '20px'
        container.style.zIndex = '9999'
        container.style.display = 'flex'
        container.style.flexDirection = 'column'
        container.style.gap = '10px'
        document.body.appendChild(container)
    }

    const toast = document.createElement('div')
    toast.className = `glass-panel toast-${type}`
    toast.style.padding = '15px 20px'
    toast.style.minWidth = '300px'
    toast.style.animation = 'slide-in 0.3s ease-out'
    toast.style.borderLeft = `4px solid var(${type === 'error' ? '--emergency-red' : type === 'success' ? '--olive-drab' : '--tan-text'})`
    
    toast.innerHTML = `
        <div style="font-weight: bold; color: var(${type === 'error' ? '--emergency-red' : type === 'success' ? '--olive-drab' : '--tan-text'}); margin-bottom: 5px; font-family: var(--font-mono); font-size: 0.8rem; letter-spacing: 1px;">[ ${title.toUpperCase()} ]</div>
        <div style="font-size: 0.95rem;">${message}</div>
    `
    container.appendChild(toast)
    
    setTimeout(() => {
        toast.style.animation = 'slide-out 0.3s ease-in forwards'
        setTimeout(() => toast.remove(), 300)
    }, 5000)
}

/**
 * Core Render Loop
 */
function render() {
  const app = document.querySelector<HTMLDivElement>('#app')!
  app.innerHTML = ''

  // Background Layer
  const bg = document.createElement('div')
  bg.className = 'bg-layer'
  
  // Custom Family BG logic
  if (state.currentScreen === 'chat' && state.activeChatContactId.startsWith('FAM-') && state.familyBg) {
      bg.style.backgroundImage = `url(${state.familyBg})`
  } else {
      bg.style.backgroundImage = `url('/assets/${getBackgroundImage()}')`
  }

  if (state.isLockdown) bg.style.filter = 'grayscale(1) contrast(2) brightness(0.5)'
  app.appendChild(bg)
  app.appendChild(Object.assign(document.createElement('div'), { className: 'bg-overlay' }))
  
  // Scanline overlay
  app.appendChild(Object.assign(document.createElement('div'), { className: 'scanline' }))

  switch (state.currentScreen) {
    case 'splash': renderSplash(app); break
    case 'onboarding': renderOnboarding(app); break
    case 'registration': renderRegistration(app); break
    case 'dashboard': renderDashboard(app); break
    case 'chat': renderChat(app); break
  }

  // Biometric Modal
  if (state.isBiometricScanning) renderBiometricOverlay(app)
}

function getBackgroundImage() {
  if (state.currentScreen === 'splash' || state.currentScreen === 'onboarding' || state.currentScreen === 'registration') return 'intro.png'
  switch (state.userRole) {
    case 'Officer': return 'officials.png'
    case 'Soldier': return 'soldiers.png'
    case 'Family': return 'family.png'
    default: return 'intro.png'
  }
}

/**
 * Screen: Splash
 */
function renderSplash(container: HTMLElement) {
    const splash = document.createElement('div')
    splash.className = 'glass-panel flex-col flex-center'
    splash.innerHTML = `
        <h1>KAVACH</h1>
        <p class="hud-label" style="margin-top: 1rem;">SECURE COMMAND HUB</p>
        <p style="margin-top: 2rem; font-family: var(--font-mono); font-size: 0.8rem; opacity: 0.6">BOOTING SECURE_OS_V4... [OK]</p>
    `
    container.appendChild(splash)
    setTimeout(() => {
        state.currentScreen = 'onboarding'
        render()
    }, 2000)
}

/**
 * Screen: Onboarding (Login)
 */
function renderOnboarding(container: HTMLElement) {
    const panel = document.createElement('div')
    panel.className = 'glass-panel flex-col'
    panel.style.maxWidth = '420px'
    panel.style.zIndex = '10'
    panel.innerHTML = `
        <h2 style="color: var(--tan-text); text-align: center; margin-bottom: 2rem; letter-spacing: 2px;">SECURE COMMAND HUB</h2>
        
        <p class="hud-label">CLASSIFICATION</p>
        <div class="flex-center" style="gap: 10px; margin: 10px 0 24px;">
            ${['Officer', 'Soldier', 'Family'].map(role => `
                <button class="btn-primary role-chip ${state.userRole === role ? 'active' : ''}" style="padding: 10px 18px; font-size: 0.75rem;" onclick="setRole('${role}')">${role}</button>
            `).join('')}
        </div>

        <p class="hud-label">NETWORK AUTHENTICATION</p>
        <input type="text" class="hud-input" placeholder="Server IPv4" data-bind="serverIp" value="${state.serverIp}">
        
        ${state.userRole !== 'Family' ? `
            <p class="hud-label">MILITARY IDENTITY TOKEN</p>
            <input type="password" class="hud-input" placeholder="Enter ID/Token (e.g. SOL-001)" data-bind="token" value="${state.token}">
        ` : `
            <p class="hud-label">MILITARY INVITE TOKEN</p>
            <input type="password" class="hud-input" placeholder="Enter ID/Token" data-bind="token" value="${state.token}">
            
            <p class="hud-label">SOLDIER SERVICE ID</p>
            <input type="text" class="hud-input" placeholder="e.g. SOL-001" data-bind="familyBindId" value="${state.familyBindId}">
        `}

        <button class="btn-primary" id="authBtn" style="margin-top: 1rem;">AUTHENTICATE DEVICE</button>
        
        <button class="btn-primary" style="background: transparent; color: var(--tan-text); font-size: 0.7rem; margin-top: 1.5rem; text-decoration: underline;" onclick="navigateTo('registration')">
            UNREGISTERED DEVICE? INITIATE NEW CLEARANCE.
        </button>
    `
    container.appendChild(panel)

    panel.querySelectorAll('[data-bind]').forEach(input => {
        input.addEventListener('input', (e) => {
            const key = (e.target as HTMLInputElement).getAttribute('data-bind') as keyof typeof state
            ;(state as any)[key] = (e.target as HTMLInputElement).value
        })
    })

    panel.querySelector('#authBtn')?.addEventListener('click', async () => {
        const tokenStr = state.token.trim()
        
        if (!tokenStr) return showToast('AUTH ERROR', "IDENT_TOKEN REQUIRED", 'error')
        if (state.userRole === 'Family' && !state.familyBindId.trim()) return showToast('AUTH ERROR', "SOLDIER ID REQUIRED", 'error')

        const ok = await fetchDirectory();
        if(!ok) return;

        const targetId = state.userRole === 'Family' ? `FAM-${state.familyBindId.trim()}` : tokenStr

        const found = state.allUsers.find(u => u.serviceId === targetId && u.role === state.userRole)
        if (!found) {
            return showRedAlert("UNAUTHORIZED SERVICE ID. DEVICE LOCKDOWN INITIATED.")
        }

        state.currentUserId = found.serviceId
        state.userName = found.name
        state.userRole = found.role
        
        setupContacts()

        wsManager.connect(`ws://${state.serverIp}:3000`, state.currentUserId, handleIncomingMessage)
        state.currentScreen = 'dashboard'
        showToast('LOGIN SUCCESS', `Welcome, ${found.name}`, 'success')
        render()
    })
}

function setupContacts() {
    const officials = state.allUsers.filter(u => u.role === 'Officer');
    const soldiers = state.allUsers.filter(u => u.role === 'Soldier');
    const families = state.allUsers.filter(u => u.role === 'Family');

    if (state.userRole === 'Officer') {
        state.officialContacts = officials
            .filter(u => u.serviceId !== state.currentUserId)
            .map(o => ({ name: o.name, id: o.serviceId }))
        state.familyContacts = families
            .filter(f => f.unitOrLink === state.currentUserId)
            .map(f => ({ name: f.name, id: f.serviceId }))
    } else if (state.userRole === 'Soldier') {
        state.officialContacts = officials.slice(0, 3).map(o => ({ name: o.name, id: o.serviceId }))
        state.familyContacts = families
            .filter(f => f.unitOrLink === state.currentUserId)
            .map(f => ({ name: f.name, id: f.serviceId }))
    } else {
        const linkedSoldierId = families.find(f => f.serviceId === state.currentUserId)?.unitOrLink
        const linkedSoldier = soldiers.find(s => s.serviceId === linkedSoldierId)
        state.officialContacts = []
        state.familyContacts = linkedSoldier ? [{ name: linkedSoldier.name, id: linkedSoldier.serviceId }] : []
    }
}

/**
 * Screen: Registration
 */
function renderRegistration(container: HTMLElement) {
    const panel = document.createElement('div')
    panel.className = 'glass-panel flex-col'
    panel.style.width = '450px'
    panel.style.zIndex = '10'
    panel.innerHTML = `
        <h2 style="color: var(--tan-text); text-align: center; margin-bottom: 0.5rem;">NEW COMPONENT CLEARANCE</h2>
        <p style="color: gray; font-size: 0.8rem; text-align: center; margin-bottom: 1.5rem;">Select Registration Role</p>
        
        <div class="flex-center" style="gap: 10px; margin-bottom: 24px;">
            ${['Officer', 'Soldier', 'Family'].map(role => `
                <button class="btn-primary role-chip ${state.userRole === role ? 'active' : ''}" style="padding: 8px 16px; font-size: 0.75rem;" onclick="setRole('${role}')">${role}</button>
            `).join('')}
        </div>

        ${state.showRedAlert ? `
            <div class="red-alert-card">
                <span style="font-size: 1.2rem;">⚠️</span>
                <div class="flex-col">
                    <span style="font-weight: 800; font-size: 0.8rem;">RED ALERT</span>
                    <span style="font-size: 0.75rem; letter-spacing: 0.5px;">${state.errorMessage}</span>
                </div>
            </div>
        ` : ''}

        <div class="flex-col" style="background: rgba(46, 59, 50, 0.2); padding: 20px; border-radius: 8px; border: 1px solid var(--border-color);">
            <p class="hud-label">Full Legal Name</p>
            <input type="text" class="hud-input" placeholder="Enter Name" data-bind="name" value="${state.registration.name}">
            
            ${state.userRole !== 'Family' ? `
                <p class="hud-label">Military Service ID No.</p>
                <input type="text" class="hud-input" placeholder="OFF-XXX / SOL-XXX" data-bind="serviceId" value="${state.registration.serviceId}">
                <p class="hud-label">Rank / Title</p>
                <input type="text" class="hud-input" placeholder="e.g. Major" data-bind="rank" value="${state.registration.rank}">
            ` : `
                <p class="hud-label">Relation (e.g. Spouse)</p>
                <input type="text" class="hud-input" placeholder="Direct Relation" data-bind="relation" value="${state.registration.relation}">
                <p class="hud-label">Direct Link Soldier ID</p>
                <input type="text" class="hud-input" placeholder="SOL-XXX or OFF-XXX" data-bind="soldierId" value="${state.registration.soldierId}">
            `}
        </div>

        <button class="btn-primary" style="margin-top: 1.5rem;" id="regBtn">ENROLL BIOMETRICS & REGISTER</button>
        <button class="btn-primary" style="background: transparent; color: var(--tan-text); font-size: 0.75rem; margin-top: 10px;" onclick="navigateTo('onboarding')">← CANCEL & RETURN</button>
    `
    container.appendChild(panel)

    panel.querySelectorAll('[data-bind]').forEach(input => {
        input.addEventListener('input', (e) => {
            const key = (e.target as HTMLInputElement).getAttribute('data-bind') as keyof typeof state.registration
            state.registration[key] = (e.target as HTMLInputElement).value
        })
    })

    panel.querySelector('#regBtn')?.addEventListener('click', async () => {
        const targetId = state.userRole === 'Family' 
            ? `FAM-${state.registration.soldierId.trim()}` 
            : state.registration.serviceId.trim()
            
        if (!targetId || targetId === 'FAM-') return showToast('VALIDATION ERROR', 'IDENTITY DATA REQUIRED', 'error')

        const ok = await fetchDirectory();
        if(!ok) return;

        // Must match the role selected
        const found = state.allUsers.find(u => u.serviceId === targetId && u.role === state.userRole)
        if (!found) {
            state.showRedAlert = true
            state.errorMessage = "UNAUTHORIZED SERVICE ID FOR ROLE. DEVICE LOCKDOWN INITIATED."
            state.isLockdown = true
            render()
            return
        }

        state.isBiometricScanning = true
        state.isLockdown = false
        state.showRedAlert = false
        render()
        
        setTimeout(() => {
            state.isBiometricScanning = false
            state.currentScreen = 'onboarding'
            // Clear inputs
            state.registration = { name: '', serviceId: '', rank: '', unit: '', relation: '', soldierId: '' }
            render()
            showToast('ENROLLMENT COMPLETE', "Physical Biological Signature Captured. Identity Linked.", 'success')
        }, 4000)
    })
}

/**
 * Screen: Dashboard
 */
function renderDashboard(container: HTMLElement) {
    const wrapper = document.createElement('div')
    wrapper.style.width = '100%'
    wrapper.style.height = '100%'
    wrapper.style.display = 'flex'
    wrapper.style.justifyContent = 'center'
    wrapper.style.alignItems = 'center'
    wrapper.style.position = 'relative'

    // Highly Visible Sweeping Radar for Dashboard
    const radar = document.createElement('div')
    radar.className = state.isEmergency ? 'radar-hub red-alert' : 'radar-hub'
    radar.innerHTML = `<div class="radar-grid"></div><div class="radar-dot" style="top: 30%; left: 40%;"></div><div class="radar-dot" style="top: 70%; left: 60%; animation-delay: 1s;"></div>`
    wrapper.appendChild(radar)

    const panel = document.createElement('div')
    panel.className = 'glass-panel flex-col'
    panel.style.width = '90%'
    panel.style.maxWidth = '640px'
    panel.style.height = '85vh'
    panel.style.zIndex = '10'

    panel.innerHTML = `
        <div class="flex-center" style="justify-content: space-between; margin-bottom: 1.5rem;">
            <h1>KAVACH HUD</h1>
            <button class="btn-primary" style="background: transparent; color: var(--tan-text); font-size: 0.7rem;" onclick="logout()">LOGOUT</button>
        </div>
        
        <div style="background: var(--olive-drab); padding: 6px 16px; border-radius: 4px; display: inline-block; align-self: center; margin-bottom: 2rem;">
            <span class="hud-label" style="color: white; font-size: 0.8rem;">CLEARANCE LEVEL: ${state.userRole.toUpperCase()}</span>
        </div>

        <div style="overflow-y: auto; flex-grow: 1; padding-right: 10px;">
            ${state.isEmergency ? `
                <div style="margin-bottom: 2rem;">
                    <p class="hud-label" style="color: #FF4444; margin-bottom: 8px;">EMERGENCY LOCKDOWN ACTIVE</p>
                    <div style="height: 1px; background: #8B0000; margin-bottom: 12px;"></div>
                    <button class="btn-primary btn-emergency" style="width: 100%; height: 60px;" onclick="dismissEmergency()">
                        DISMISS RED ALERT
                    </button>
                </div>
            ` : (state.userRole === 'Officer' ? `
                <div style="margin-bottom: 2rem;">
                    <p class="hud-label" style="color: #FF4444; margin-bottom: 8px;">EMERGENCY PROTOCOLS</p>
                    <div style="height: 1px; background: #8B0000; margin-bottom: 12px;"></div>
                    <button class="btn-primary btn-emergency" style="width: 100%; height: 60px;" onclick="broadcastEmergency()">
                        ISSUE EMERGENCY BROADCAST
                    </button>
                </div>
            ` : '')}

            <div class="folder-header">
                <p class="hud-label">OFFICIAL DIRECTORY</p>
                <span class="hud-label" style="cursor: pointer; color: var(--tan-text)" onclick="addContact()">[+] ADD LINK</span>
            </div>
            
            <div class="flex-col" style="gap: 10px; margin-bottom: 2rem;">
                ${state.officialContacts.length > 0 ? state.officialContacts.map(c => `
                    <button class="btn-primary" style="text-align: left; background: var(--olive-drab); font-weight: 500;" onclick="openChat('${c.id}', '${c.name}')">
                        <span style="font-family: var(--font-mono); font-size: 0.6rem; opacity: 0.6">SECURE LINK:</span> ${c.name}
                    </button>
                `).join('') : '<p class="hud-label" style="opacity:0.5; text-align:center;">NO CONTACTS FOUND</p>'}
            </div>

            <div class="folder-header">
                <p class="hud-label">PERSONAL CHANNELS</p>
                <span class="hud-label" style="cursor: pointer; color: var(--tan-text)" onclick="addContact()">[+] ADD LINK</span>
            </div>

            <div class="flex-col" style="gap: 10px;">
                ${state.familyContacts.length > 0 ? state.familyContacts.map(c => `
                    <button class="btn-primary" style="text-align: left; background: var(--dark-charcoal); font-weight: 500;" onclick="openChat('${c.id}', '${c.name}')">
                         <span style="font-family: var(--font-mono); font-size: 0.6rem; opacity: 0.6">PERSONAL:</span> ${c.name}
                    </button>
                `).join('') : '<p class="hud-label" style="opacity:0.5; text-align:center;">NO CONTACTS FOUND</p>'}
            </div>
        </div>
    `
    wrapper.appendChild(panel)
    container.appendChild(wrapper)
}

/**
 * Screen: Chat
 */
function renderChat(container: HTMLElement) {
    const isFamily = state.activeChatContactId.startsWith('FAM-') || state.userRole === 'Family'
    
    const panel = document.createElement('div')
    panel.className = 'glass-panel flex-col'
    panel.style.width = '90%'
    panel.style.maxWidth = '700px'
    panel.style.height = '92vh'
    panel.style.zIndex = '10'

    panel.innerHTML = `
        <div class="flex-center" style="justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem; margin-bottom: 1rem;">
            <div>
                <p class="hud-label" style="opacity: 0.5;">SECURE LINK ESTABLISHED</p>
                <h3 style="color: var(--tan-text); font-weight: 800;">Secure Chat: ${state.activeChatContactName}</h3>
            </div>
            <div class="flex-center" style="gap: 10px;">
                ${isFamily ? '<button class="btn-primary" style="padding: 6px 12px; font-size: 0.6rem;" onclick="document.getElementById(\'bgUpload\').click()">UPLOAD BG</button>' : ''}
                <input type="file" id="bgUpload" style="display:none" onchange="handleBgUpload(event)">
                <button class="btn-primary" style="padding: 6px 12px; font-size: 0.6rem;" onclick="navigateTo('dashboard')">BACK</button>
            </div>
        </div>

        <div id="msgLog" style="flex-grow: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; padding: 10px;">
            ${state.messages.filter(m => 
                (m.senderId === state.currentUserId && m.receiverId === state.activeChatContactId) ||
                (m.senderId === state.activeChatContactId && m.receiverId === state.currentUserId)
            ).map(m => `
                <div class="message-bubble ${m.senderId === state.currentUserId ? 'sent' : 'received'}">
                    <div class="hud-label" style="font-size: 0.55rem; margin-bottom: 4px; opacity: 0.7;">
                        ${m.senderId === state.currentUserId ? 'IDENTITY_OWN' : 'IDENTITY_REMOTE'} @ ${new Date(m.timestamp).toLocaleTimeString()}
                    </div>
                    ${m.text}
                </div>
            `).join('')}
        </div>

        <div class="flex-center" style="gap: 12px; margin-top: 1rem;">
            <input type="file" id="mediaUpload" accept="image/*" style="display:none" onchange="handleMediaUpload(event)">
            <button class="btn-primary" style="padding: 10px; font-size: 1rem;" onclick="document.getElementById('mediaUpload').click()">📎</button>
            <input type="text" class="hud-input" style="margin: 0;" id="chatInput" placeholder="Type an encrypted message...">
            <button class="btn-primary" id="chatSend">SEND</button>
        </div>
    `
    container.appendChild(panel)
    
    const log = panel.querySelector('#msgLog')!
    log.scrollTop = log.scrollHeight

    panel.querySelector('#chatSend')?.addEventListener('click', async () => {
        const input = document.querySelector<HTMLInputElement>('#chatInput')!
        if (!input.value.trim()) return
        
        const text = input.value.trim()
        const encrypted = await CryptoUtils.encrypt(text)
        
        wsManager.send('send_message', state.currentUserId, state.activeChatContactId, encrypted)

        state.messages.push({
            id: Date.now().toString(),
            senderId: state.currentUserId,
            receiverId: state.activeChatContactId,
            text,
            timestamp: Date.now()
        })
        saveMessages()
        input.value = ''
        render()
    })
}

/**
 * Overlay: Biometric Simulation
 */
function renderBiometricOverlay(container: HTMLElement) {
    const overlay = document.createElement('div')
    overlay.className = 'biometric-overlay'
    overlay.innerHTML = `
        <h2 style="color: var(--tan-text); margin-bottom: 2rem; letter-spacing: 4px;">INITIALIZE 3FA LOCK</h2>
        <div class="scanning-box">
            <div class="scanning-line"></div>
            <div class="flex-center" style="height: 100%; opacity: 0.2;">
                <span style="font-size: 8rem;">🖐️</span>
            </div>
        </div>
        <p class="hud-label" style="color: var(--accent-blue);">BINDING PHYSICAL IDENTITY METRICS...</p>
    `
    container.appendChild(overlay)
}

/**
 * Handlers
 */
async function handleIncomingMessage(data: any) {
    if (data.type === 'receive_message' || data.type === 'emergency_alert') {
        const decrypted = await CryptoUtils.decrypt(data.encryptedPayload)
        
        const senderInfo = state.allUsers.find(u => u.serviceId === data.senderId)
        const senderName = senderInfo ? senderInfo.name : data.senderId

        // Auto-add unknown senders to contacts so they appear in Dashboard
        const isOfficial = state.officialContacts.some(c => c.id === data.senderId)
        const isFamily = state.familyContacts.some(c => c.id === data.senderId)
        if (!isOfficial && !isFamily) {
            if (data.senderId.startsWith('FAM-')) {
                state.familyContacts.push({ name: senderName, id: data.senderId })
            } else {
                state.officialContacts.push({ name: senderName, id: data.senderId })
            }
        }

        if (data.type === 'emergency_alert') {
            state.isEmergency = true
            state.isLockdown = true
            state.showRedAlert = true
            state.errorMessage = decrypted
            showToast('EMERGENCY BROADCAST', decrypted, 'error')
        }

        state.messages.push({
            id: data.messageId || Math.random().toString(),
            senderId: data.senderId, // Always use Service ID internally
            receiverId: state.currentUserId,
            text: data.type === 'emergency_alert' ? `⚠️ BROADCAST: ${decrypted}` : decrypted,
            timestamp: Date.now()
        })
        saveMessages()
        
        // Show non-blocking notification if not actively chatting with the sender
        if (data.type !== 'emergency_alert' && (state.currentScreen !== 'chat' || state.activeChatContactId !== data.senderId)) {
            showToast('INCOMING TRANSMISSION', `New encrypted packet from ${senderName}`, 'info')
        }

        if (state.currentScreen === 'chat' || state.currentScreen === 'dashboard') render()
    }
}

function showRedAlert(msg: string) {
    state.errorMessage = msg
    state.showRedAlert = true
    state.isLockdown = true
    render()
}

// Global UI Actions
;(window as any).setRole = (role: string) => { state.userRole = role; render() }
;(window as any).navigateTo = (screen: string) => { 
    state.currentScreen = screen; 
    state.isLockdown = false; 
    state.showRedAlert = false;
    render() 
}
;(window as any).openChat = (id: string, name: string) => { 
    state.activeChatContactId = id
    state.activeChatContactName = name
    state.currentScreen = 'chat'
    render() 
}
;(window as any).logout = () => { wsManager.disconnect(); state.currentUserId = ''; state.currentScreen = 'onboarding'; state.isEmergency = false; render() }
;(window as any).dismissEmergency = () => {
    state.isEmergency = false;
    state.isLockdown = false;
    state.showRedAlert = false;
    render();
}
;(window as any).broadcastEmergency = async () => {
    const encryptedText = await CryptoUtils.encrypt('!!! EMERGENCY BROADCAST: CRITICAL STATUS !!!');
    wsManager.sendEmergency(state.currentUserId, 'ALL_UNITS', encryptedText);
    showToast('BROADCAST INITIATED', "EMERGENCY PROTOCOL ACTIVATED. ALL UNITS NOTIFIED.", 'success');
}
;(window as any).addContact = () => {
    const val = prompt("Enter Target Identification (Service ID):")
    if (val) {
        const found = state.allUsers.find(u => u.serviceId === val)
        if (found) {
            state.officialContacts.push({ name: found.name, id: found.serviceId })
            render()
        } else {
            showToast('ROUTING ERROR', "COULD NOT RESOLVE TARGET ID.", 'error')
        }
    }
}
;(window as any).handleBgUpload = (e: any) => {
    const file = e.target.files[0]
    if (file) {
        const reader = new FileReader()
        reader.onload = (event) => {
            const result = event.target?.result as string
            state.familyBg = result
            localStorage.setItem('family_bg_uri', result)
            render()
        }
        reader.readAsDataURL(file)
    }
}
;(window as any).handleMediaUpload = async (e: any) => {
    const file = e.target.files[0]
    if (file) {
        const reader = new FileReader()
        reader.onload = async (event) => {
            const result = event.target?.result as string
            
            // Format as HTML image tag for easy rendering on receiver's end
            const imgTag = `<img src="${result}" style="max-width: 200px; border-radius: 8px; margin-top: 5px;" alt="Encrypted Image"/>`
            
            // Reusing existing E2EE Encryptor
            const encrypted = await CryptoUtils.encrypt(imgTag)
            
            wsManager.send('send_message', state.currentUserId, state.activeChatContactId, encrypted)

            state.messages.push({
                id: Date.now().toString(),
                senderId: state.currentUserId,
                receiverId: state.activeChatContactId,
                text: imgTag,
                timestamp: Date.now()
            })
            saveMessages()
            render()
        }
        // Downscale before reading to prevent large Payload Anomalies (limit ~2MB)
        reader.readAsDataURL(file)
    }
}

// Initial Render
render()
