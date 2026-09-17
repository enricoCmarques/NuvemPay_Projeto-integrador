const el = (id) => document.getElementById(id);
let token = localStorage.getItem('pix_token');
let currentUser = null;
let currentHistory = [];
let currentReceiptTx = null;

const sections = {
    login: el('login-section'), 
    register: el('register-section'), 
    dashboard: el('dashboard-section'), 
    modal: el('receipt-modal'), 
    modal2fa: el('twofa-modal')
};

const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function handleApiError(data, res) {
    if (res.status === 401 && data.expired) { alert("Sua sessão expirou."); logout(); }
    throw new Error(data.error || "Erro inesperado.");
}

document.addEventListener('DOMContentLoaded', () => { 
    if (token) loadDashboard(); 
});

// Navegação entre Login e Registro
el('go-to-register').addEventListener('click', (e) => { 
    e.preventDefault(); 
    sections.login.classList.add('hidden'); 
    sections.register.classList.remove('hidden'); 
});

el('go-to-login').addEventListener('click', (e) => { 
    e.preventDefault(); 
    sections.register.classList.add('hidden'); 
    sections.login.classList.remove('hidden'); 
});

// Fechar Modais
el('close-receipt').addEventListener('click', () => { 
    sections.modal.classList.add('hidden'); 
    currentReceiptTx = null; 
});

el('close-2fa-btn').addEventListener('click', () => { 
    sections.modal2fa.classList.add('hidden'); 
});

// Registrar Usuário (Corrigido!)
el('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fb = el('register-feedback'); 
    fb.innerText = "Processando..."; 
    fb.style.color = "var(--text-color)";
    
    const payload = { 
        name: el('reg-name').value.trim(), 
        username: el('reg-username').value.trim(), 
        password: el('reg-password').value, 
        pin: el('reg-pin').value 
    };
    
    try {
        const res = await fetch('/api/register', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload) 
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        
        fb.innerText = data.message; 
        fb.style.color = "var(--success-color)";
        el('register-form').reset();
        
        setTimeout(() => { 
            fb.innerText = ""; 
            sections.register.classList.add('hidden'); 
            sections.login.classList.remove('hidden'); 
        }, 2000);
    } catch (err) { 
        fb.innerText = err.message; 
        fb.style.color = "var(--error-color)"; 
    }
});

// Fazer Login
el('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errDiv = el('login-error'); 
    errDiv.innerText = "";
    
    const payload = { 
        username: el('username').value.trim(), 
        password: el('password').value 
    };
    
    const totpInput = el('login-totp');
    if (!el('login-2fa-group').classList.contains('hidden')) {
        payload.totpCode = totpInput.value.trim();
    }

    try {
        const res = await fetch('/api/login', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload) 
        });
        const data = await res.json();
        
        if (!res.ok) {
            if (data.error === "REQUIRE_2FA") {
                el('login-2fa-group').classList.remove('hidden'); 
                totpInput.setAttribute('required', 'true');
                errDiv.innerText = "Digite o código 2FA de 6 dígitos."; 
                errDiv.style.color = "var(--success-color)"; 
                return;
            }
            throw new Error(data.error);
        }
        
        el('login-2fa-group').classList.add('hidden'); 
        totpInput.removeAttribute('required'); 
        totpInput.value = "";
        
        token = data.token; 
        localStorage.setItem('pix_token', token); 
        el('login-form').reset(); 
        loadDashboard();
    } catch (err) { 
        errDiv.innerText = err.message; 
        errDiv.style.color = "var(--error-color)"; 
    }
});

// Carregar Dashboard
async function loadDashboard() {
    try {
        const res = await fetch('/api/me', { headers: { 'Authorization': token } });
        const data = await res.json();
        if (!res.ok) return handleApiError(data, res);
        
        currentUser = data; 
        updateUI(); 
        loadHistory();
        
        sections.login.classList.add('hidden'); 
        sections.register.classList.add('hidden'); 
        sections.dashboard.classList.remove('hidden');
    } catch (err) { logout(); }
}

function updateUI() {
    el('user-name-display').innerText = escapeHtml(currentUser.name);
    el('balance-display').innerText = formatter.format(currentUser.balance);
    
    const select = el('recipient'); 
    select.innerHTML = '<option value="" disabled selected>Selecione um contato</option>';
    
    currentUser.usersList.forEach(u => {
        if (u.id !== currentUser.id) {
            const opt = document.createElement('option'); 
            opt.value = u.id; 
            opt.textContent = escapeHtml(u.name); 
            select.appendChild(opt);
        }
    });
    
    if (currentUser.twoFactorEnabled) { 
        el('setup-2fa-btn').innerText = "2FA Ativado ✅"; 
        el('setup-2fa-btn').disabled = true; 
    } else { 
        el('setup-2fa-btn').innerText = "Ativar 2FA"; 
        el('setup-2fa-btn').disabled = false; 
    }
}

function getUserName(id) {
    if (!currentUser || !currentUser.usersList) return escapeHtml(id);
    if (id === currentUser.id) return escapeHtml(currentUser.name);
    const user = currentUser.usersList.find(u => u.id === id);
    return user ? escapeHtml(user.name) : "Usuário Desconhecido";
}

// Carregar Histórico
async function loadHistory() {
    try {
        const res = await fetch('/api/history', { headers: { 'Authorization': token } });
        currentHistory = await res.json();
        if (!res.ok) return handleApiError(currentHistory, res);
        
        const list = el('history-list'); 
        list.innerHTML = '';
        
        if (currentHistory.length === 0) { 
            list.innerHTML = '<p>Nenhuma transação.</p>'; 
            return; 
        }

        currentHistory.forEach(tx => {
            const isSender = tx.senderId === currentUser.id;
            const typeText = isSender ? `Enviou para ${getUserName(tx.recipientId)}` : `Recebeu de ${getUserName(tx.senderId)}`;
            const amountText = (isSender ? '-' : '+') + formatter.format(tx.amount);
            const amountColor = isSender ? 'var(--error-color)' : 'var(--success-color)';
            const integrityAlert = tx.isValid ? '' : '<span style="color:var(--error-color); font-weight:bold;"> ⚠️ ADULTERADO</span>';

            const div = document.createElement('div');
            div.innerHTML = `
                <p>
                    <strong>${typeText}</strong> | ${new Date(tx.timestamp).toLocaleString('pt-BR')}
                    ${tx.isValid ? `<button class="receipt-btn" onclick="showReceipt('${tx.id}')">Comprovante</button>` : ''} 
                    ${integrityAlert}<br>
                    <span style="color:${amountColor}">${amountText}</span>
                </p>
                <hr>
            `;
            list.appendChild(div);
        });
    } catch (err) { console.error(err); }
}

window.showReceipt = function(txId) {
    const tx = currentHistory.find(t => t.id === txId);
    if (!tx) return;
    
    currentReceiptTx = tx;
    const details = el('receipt-details');
    details.innerHTML = `
        <p><strong>ID:</strong> ${tx.id}</p>
        <p><strong>Data:</strong> ${new Date(tx.timestamp).toLocaleString('pt-BR')}</p>
        <p><strong>Valor:</strong> ${formatter.format(tx.amount)}</p>
        <p><strong>De:</strong> ${getUserName(tx.senderId)}</p>
        <p><strong>Para:</strong> ${getUserName(tx.recipientId)}</p>
        <p style="color:var(--success-color); margin-top:15px; font-weight:bold;">Operação Autenticada ✅</p>
    `;
    sections.modal.classList.remove('hidden');
};

el('download-receipt').addEventListener('click', () => {
    if (!currentReceiptTx) return;
    const tx = currentReceiptTx;
    
    // Texto do recibo completo e com a crase fechada no final!
    const receiptText = `COMPROVANTE PIX\nID: ${tx.id}\nData: ${new Date(tx.timestamp).toLocaleString('pt-BR')}\nValor: ${formatter.format(tx.amount)}\nDe: ${getUserName(tx.senderId)}\nPara: ${getUserName(tx.recipientId)}\n\nOperação Autenticada`;
    
    const blob = new Blob([receiptText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); 
    a.href = url; 
    a.download = `Pix_${tx.id}.txt`; 
    document.body.appendChild(a); 
    a.click(); 
    document.body.removeChild(a); 
    URL.revokeObjectURL(url);
});

// ENVIAR PIX (Aqui é o lugar correto da conversão de valor!)
el('pix-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fb = el('pix-feedback'); 
    fb.innerText = "Processando...";
    
    try {
        const payload = { 
            recipientId: el('recipient').value, 
            // Converte a string "R$ 1.500,00" de volta para o número 1500.00
            amount: Number(el('amount').value.replace(/\D/g, '')) / 100, 
            pin: el('pix-pin').value 
        };

        const res = await fetch('/api/pix', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'Authorization': token },
            body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        if (!res.ok) return handleApiError(data, res);
        
        fb.innerText = data.message; 
        fb.style.color = "var(--success-color)"; 
        
        currentUser.balance = data.newBalance; 
        el('balance-display').innerText = formatter.format(currentUser.balance);
        
        el('pix-form').reset(); 
        loadHistory(); 
        setTimeout(() => { fb.innerText = ""; }, 3000);
    } catch (err) { 
        fb.innerText = err.message; 
        fb.style.color = "var(--error-color)"; 
    }
});

// Configuração e Validação de 2FA
el('setup-2fa-btn').addEventListener('click', async () => {
    try {
        const res = await fetch('/api/2fa/setup', { headers: { 'Authorization': token } });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        
        el('qr-code-img').src = data.qrCodeImageUrl; 
        el('secret-text').innerText = data.secret; 
        el('twofa-feedback').innerText = ""; 
        el('setup-totp-code').value = ""; 
        sections.modal2fa.classList.remove('hidden');
    } catch (error) { alert(error.message); }
});

el('verify-2fa-btn').addEventListener('click', async () => {
    const code = el('setup-totp-code').value.trim();
    const fb = el('twofa-feedback');
    
    if (!code || code.length !== 6) { 
        fb.innerText = "Digite 6 dígitos."; 
        fb.style.color = "var(--error-color)"; 
        return; 
    }
    
    try {
        const res = await fetch('/api/2fa/verify', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'Authorization': token }, 
            body: JSON.stringify({ totpCode: code }) 
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        
        fb.innerText = data.message; 
        fb.style.color = "var(--success-color)"; 
        
        setTimeout(() => { 
            sections.modal2fa.classList.add('hidden'); 
            el('setup-2fa-btn').innerText = "2FA Ativado ✅"; 
            el('setup-2fa-btn').disabled = true; 
            currentUser.twoFactorEnabled = true; 
        }, 1500);
    } catch (error) { 
        fb.innerText = error.message; 
        fb.style.color = "var(--error-color)"; 
    }
});

// Logout
function logout() {
    token = null; 
    currentUser = null; 
    localStorage.removeItem('pix_token');
    
    sections.dashboard.classList.add('hidden'); 
    sections.login.classList.remove('hidden');
    
    el('pix-feedback').innerText = ""; 
    el('setup-2fa-btn').innerText = "Ativar 2FA"; 
    el('setup-2fa-btn').disabled = false; 
    el('login-2fa-group').classList.add('hidden'); 
    el('login-totp').removeAttribute('required');
}

el('logout-btn').addEventListener('click', logout);

// Máscara de Moeda (BRL) - Atualiza enquanto o usuário digita
el('amount').addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, ""); // Remove tudo que não é número
    if (value === "") { 
        e.target.value = ""; 
        return; 
    }
    value = (parseInt(value, 10) / 100).toFixed(2) + "";
    value = value.replace(".", ",");
    value = value.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
    e.target.value = "R$ " + value;
});