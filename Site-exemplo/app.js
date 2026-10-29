// Configure um ID de cliente OAuth 2.0 do tipo "Aplicativo da Web" no Google Cloud.
const GOOGLE_CLIENT_ID = "";
const GOOGLE_TASKS_SCOPE = "https://www.googleapis.com/auth/tasks";
const DB_NAME = "ordens-servico";
const DB_VERSION = 1;
const STORE_NAME = "orders";

const form = document.querySelector("#service-form");
const ordersList = document.querySelector("#orders-list");
const count = document.querySelector("#order-count");
const connectButton = document.querySelector("#connect-button");
const syncStatus = document.querySelector("#sync-status");
const formError = document.querySelector("#form-error");
const exportHistoryTxt = document.querySelector("#export-history-txt");
const exportHistoryZip = document.querySelector("#export-history-zip");

let database;
let accessToken = "";
let tokenClient;
let syncInProgress = false;

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains(STORE_NAME)) {
                request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("Não foi possível abrir o armazenamento local."));
    });
}

function allOrders() {
    return new Promise((resolve, reject) => {
        const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
        request.onsuccess = () => resolve(request.result.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
        request.onerror = () => reject(request.error || new Error("Não foi possível carregar as ordens."));
    });
}

function saveOrder(order) {
    return new Promise((resolve, reject) => {
        const request = database.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(order);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error || new Error("Não foi possível salvar a ordem neste aparelho."));
    });
}

function deleteOrder(id) {
    return new Promise((resolve, reject) => {
        const request = database.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error || new Error("Não foi possível excluir a ordem."));
    });
}

function setSyncStatus(message, state = "local") {
    syncStatus.dataset.state = state;
    syncStatus.lastElementChild.textContent = message;
}

function formatDate(value) {
    if (!value) return "";
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
}

function parseServiceDate(value) {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
    if (!match) throw new Error("Informe a data no formato dd/MM/yyyy.");
    const [, dayText, monthText, yearText] = match;
    const day = Number(dayText);
    const month = Number(monthText);
    const year = Number(yearText);
    const date = new Date(`${yearText}-${monthText}-${dayText}T00:00:00Z`);
    if (year < 1 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
        throw new Error("Informe uma data válida no formato dd/MM/yyyy.");
    }
    return `${yearText}-${monthText}-${dayText}`;
}

function parseServiceTime(value, fieldName) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
        throw new Error(`Informe ${fieldName} no formato 24 horas HH:mm.`);
    }
    return value;
}

function formatMaskedValue(digits, groups, separator) {
    let formatted = "";
    let digitOffset = 0;
    for (let index = 0; index < groups.length; index += 1) {
        const groupLength = groups[index];
        const group = digits.slice(digitOffset, digitOffset + groupLength);
        formatted += group;
        digitOffset += group.length;
        if (group.length === groupLength && index < groups.length - 1 &&
            (digitOffset < digits.length || digitOffset < groups.reduce((sum, size) => sum + size, 0))) {
            formatted += separator;
        }
    }
    return formatted;
}

function caretAfterDigits(value, digitCount) {
    if (digitCount === 0) return 0;
    let seenDigits = 0;
    let position = 0;
    while (position < value.length && seenDigits < digitCount) {
        if (/\d/.test(value[position])) seenDigits += 1;
        position += 1;
    }
    if (seenDigits === digitCount && /[/:]/.test(value[position] || "")) position += 1;
    return position;
}

function applyInputMask(input, groups, separator) {
    const digits = input.value.replace(/\D/g, "").slice(0, groups.reduce((sum, size) => sum + size, 0));
    const digitsBeforeStart = input.value.slice(0, input.selectionStart ?? input.value.length).replace(/\D/g, "").length;
    const digitsBeforeEnd = input.value.slice(0, input.selectionEnd ?? input.value.length).replace(/\D/g, "").length;
    input.value = formatMaskedValue(digits, groups, separator);
    input.setSelectionRange(
        caretAfterDigits(input.value, Math.min(digitsBeforeStart, digits.length)),
        caretAfterDigits(input.value, Math.min(digitsBeforeEnd, digits.length))
    );
}

function bindInputMasks() {
    const masks = [
        [form.elements.date, [2, 2, 4], "/"],
        [form.elements.arrival, [2, 2], ":"],
        [form.elements.departure, [2, 2], ":"]
    ];
    for (const [input, groups, separator] of masks) {
        input.addEventListener("input", () => applyInputMask(input, groups, separator));
        input.addEventListener("keydown", (event) => {
            if (!["Backspace", "Delete"].includes(event.key) || input.selectionStart !== input.selectionEnd) return;
            const caret = input.selectionStart;
            const separatorPosition = event.key === "Backspace" ? caret - 1 : caret;
            if (!/[/:]/.test(input.value[separatorPosition] || "")) return;
            event.preventDefault();
            const digitIndex = input.value.slice(0, caret).replace(/\D/g, "").length;
            const digits = input.value.replace(/\D/g, "");
            const removeIndex = event.key === "Backspace" ? digitIndex - 1 : digitIndex;
            if (removeIndex < 0 || removeIndex >= digits.length) return;
            const remainingDigits = `${digits.slice(0, removeIndex)}${digits.slice(removeIndex + 1)}`;
            input.value = formatMaskedValue(remainingDigits, groups, separator);
            const newCaret = caretAfterDigits(input.value, Math.max(0, removeIndex));
            input.setSelectionRange(newCaret, newCaret);
        });
    }
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
}

function statusLabel(order) {
    if (order.syncState === "synced") return "Sincronizada";
    if (order.syncState === "error") return "Falha na sincronização";
    if (accessToken) return "Aguardando sincronização";
    return "Salva neste aparelho";
}

function renderOrders(orders) {
    count.textContent = String(orders.length);
    exportHistoryTxt.disabled = orders.length === 0;
    exportHistoryZip.disabled = orders.length === 0;
    if (!orders.length) {
        ordersList.innerHTML = '<div class="empty-state"><span class="empty-mark" aria-hidden="true">OS</span><p>Nenhuma ordem por aqui ainda.</p><small>Quando salvar um atendimento, ele aparecerá nesta lista.</small></div>';
        return;
    }

    ordersList.innerHTML = orders.map((order) => {
        const state = order.syncState === "error" ? "error" : order.syncState === "synced" ? "synced" : "pending";
        const details = [
            ["Chegada", order.arrival],
            ["Saída", order.departure],
            ["Problema / instalação", order.problem],
            ["Trabalho aplicado", order.work],
            ["Resultado", order.result],
            ...(order.comments ? [["Comentários", order.comments]] : []),
            ...(order.attachments.length ? [["Anexos", `${order.attachments.length} arquivo(s)`]] : [])
        ];
        return `<article class="order-card">
            <div class="order-top">
                <div><h3>${escapeHtml(order.client)}</h3><p class="order-date">${escapeHtml(formatDate(order.date))}</p></div>
                <span class="order-status" data-state="${state}">${escapeHtml(statusLabel(order))}</span>
            </div>
            <dl class="order-summary">${details.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl>
            <div class="order-actions">
                <button class="button button-outline" type="button" data-action="txt" data-id="${escapeHtml(order.id)}">Baixar TXT</button>
                ${order.attachments.length ? `<button class="button button-outline" type="button" data-action="zip" data-id="${escapeHtml(order.id)}">Baixar ZIP (${order.attachments.length})</button>` : ""}
                ${order.syncState !== "synced" ? `<button class="button button-outline" type="button" data-action="sync" data-id="${escapeHtml(order.id)}" ${accessToken ? "" : "disabled"}>Sincronizar</button>` : ""}
                <button class="button button-danger" type="button" data-action="delete" data-id="${escapeHtml(order.id)}">Excluir</button>
            </div>
        </article>`;
    }).join("");
}

function orderText(order) {
    const lines = [
        "ORDEM DE SERVIÇO",
        `Cliente: ${order.client}`,
        `Data da ordem: ${formatDate(order.date)}`,
        `Hora de chegada: ${order.arrival}`,
        `Problema encontrado / instalação a ser executada: ${order.problem}`,
        `Trabalho aplicado: ${order.work}`,
        `Resultado: ${order.result}`,
        `Hora de saída: ${order.departure}`,
        `Comentários: ${order.comments || "—"}`,
        `Anexos: ${order.attachments.length}`
    ];
    return `${lines.join("\r\n")}\r\n`;
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeFilename(value) {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "ordem";
}

function safeAttachmentName(value) {
    const extensionStart = value.lastIndexOf(".");
    const baseName = extensionStart > 0 ? value.slice(0, extensionStart) : value;
    const extension = extensionStart > 0 ? value.slice(extensionStart).replace(/[^a-zA-Z0-9.]/g, "").slice(0, 12) : "";
    return `${safeFilename(baseName)}${extension}`;
}

function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function zipDate(date = new Date()) {
    return {
        time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
        date: ((Math.max(1980, date.getFullYear()) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
    };
}

async function createZip(files) {
    const encoder = new TextEncoder();
    const localParts = [];
    const centralParts = [];
    let offset = 0;
    const stamp = zipDate();

    for (const file of files) {
        const name = encoder.encode(file.name);
        const data = file.data instanceof Blob ? new Uint8Array(await file.data.arrayBuffer()) : encoder.encode(file.data);
        const crc = crc32(data);
        const local = new Uint8Array(30 + name.length);
        const localView = new DataView(local.buffer);
        localView.setUint32(0, 0x04034b50, true);
        localView.setUint16(4, 20, true);
        localView.setUint16(6, 0x0800, true);
        localView.setUint16(10, stamp.time, true);
        localView.setUint16(12, stamp.date, true);
        localView.setUint32(14, crc, true);
        localView.setUint32(18, data.length, true);
        localView.setUint32(22, data.length, true);
        localView.setUint16(26, name.length, true);
        local.set(name, 30);
        localParts.push(local, data);

        const central = new Uint8Array(46 + name.length);
        const centralView = new DataView(central.buffer);
        centralView.setUint32(0, 0x02014b50, true);
        centralView.setUint16(4, 20, true);
        centralView.setUint16(6, 20, true);
        centralView.setUint16(8, 0x0800, true);
        centralView.setUint16(12, stamp.time, true);
        centralView.setUint16(14, stamp.date, true);
        centralView.setUint32(16, crc, true);
        centralView.setUint32(20, data.length, true);
        centralView.setUint32(24, data.length, true);
        centralView.setUint16(28, name.length, true);
        centralView.setUint32(42, offset, true);
        central.set(name, 46);
        centralParts.push(central);
        offset += local.length + data.length;
    }

    const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
    const end = new Uint8Array(22);
    const endView = new DataView(end.buffer);
    endView.setUint32(0, 0x06054b50, true);
    endView.setUint16(8, files.length, true);
    endView.setUint16(10, files.length, true);
    endView.setUint32(12, centralSize, true);
    endView.setUint32(16, offset, true);
    return new Blob([...localParts, ...centralParts, end], { type: "application/zip" });
}

function taskNotes(order) {
    return [
        `Cliente: ${order.client}`,
        `Data da ordem: ${formatDate(order.date)}`,
        `Hora de chegada: ${order.arrival}`,
        `Problema / instalação: ${order.problem}`,
        `Trabalho aplicado: ${order.work}`,
        `Resultado: ${order.result}`,
        `Hora de saída: ${order.departure}`,
        `Comentários: ${order.comments || "—"}`,
        `Anexos salvos no aparelho: ${order.attachments.length}`
    ].join("\n");
}

async function exportHistory(format) {
    try {
        const orders = await allOrders();
        if (format === "txt") {
            const text = orders.map(orderText).join("\r\n----------------------------------------\r\n\r\n");
            downloadBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), "historico-ordens-de-servico.txt");
            return;
        }

        const files = [];
        orders.forEach((order, orderIndex) => {
            const folder = `${String(orderIndex + 1).padStart(3, "0")}_${order.date}_${safeFilename(order.client)}`;
            files.push({ name: `${folder}/ordem-de-servico.txt`, data: orderText(order) });
            order.attachments.forEach((file, fileIndex) => {
                files.push({
                    name: `${folder}/anexos/${String(fileIndex + 1).padStart(2, "0")}_${safeAttachmentName(file.name)}`,
                    data: file.data
                });
            });
        });
        downloadBlob(await createZip(files), "historico-ordens-de-servico.zip");
    } catch (error) {
        setSyncStatus(`Não foi possível exportar o histórico: ${error.message}`, "error");
    }
}

async function syncOrder(order) {
    if (!accessToken) throw new Error("Conecte uma conta Google antes de sincronizar.");
    const response = await fetch("https://tasks.googleapis.com/tasks/v1/lists/@default/tasks", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            title: `OS - ${order.client} - ${formatDate(order.date)}`,
            notes: taskNotes(order)
        })
    });
    if (!response.ok) {
        const details = await response.json().catch(() => ({}));
        throw new Error(details.error?.message || `Google Tasks respondeu com erro (${response.status}).`);
    }
    order.syncState = "synced";
    await saveOrder(order);
}

async function syncPendingOrders() {
    if (!accessToken || syncInProgress) return;
    syncInProgress = true;
    connectButton.disabled = true;
    try {
        const pending = (await allOrders()).filter((order) => order.syncState !== "synced");
        for (const order of pending) {
            try {
                await syncOrder(order);
            } catch (error) {
                order.syncState = "error";
                order.syncError = error.message;
                await saveOrder(order);
                setSyncStatus(`Falha ao sincronizar: ${error.message}`, "error");
                break;
            }
        }
        if (pending.length && pending.every((order) => order.syncState === "synced")) {
            setSyncStatus("Google Tasks conectado — ordens sincronizadas.", "connected");
        } else if (!pending.length) {
            setSyncStatus("Google Tasks conectado — todas as ordens estão sincronizadas.", "connected");
        }
    } finally {
        syncInProgress = false;
        connectButton.disabled = false;
        renderOrders(await allOrders());
    }
}

function connectGoogle() {
    if (!GOOGLE_CLIENT_ID) {
        setSyncStatus("Configure o ID OAuth do Google para ativar a sincronização.", "error");
        return;
    }
    if (!window.google?.accounts?.oauth2) {
        setSyncStatus("Não foi possível carregar a autenticação do Google. Verifique a conexão.", "error");
        return;
    }
    if (!tokenClient) {
        tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: GOOGLE_TASKS_SCOPE,
            callback: (response) => {
                if (response.error) {
                    setSyncStatus(`Não foi possível conectar ao Google: ${response.error}`, "error");
                    return;
                }
                accessToken = response.access_token;
                setSyncStatus("Google Tasks conectado — sincronizando ordens pendentes.", "connected");
                syncPendingOrders().catch((error) => setSyncStatus(error.message, "error"));
            },
            error_callback: (error) => setSyncStatus(`Autenticação Google indisponível: ${error.message}`, "error")
        });
    }
    tokenClient.requestAccessToken();
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    formError.hidden = true;
    const submitButton = form.querySelector('[type="submit"]');
    submitButton.disabled = true;
    try {
        const values = new FormData(form);
        const selectedFiles = Array.from(document.querySelector("#attachments").files || []);
        const invalidFile = selectedFiles.find((file) => !file.type.startsWith("image/") && !file.type.startsWith("video/"));
        if (invalidFile) throw new Error(`Tipo de anexo não permitido: ${invalidFile.name}`);
        const client = values.get("client").trim();
        const problem = values.get("problem").trim();
        const work = values.get("work").trim();
        const result = values.get("result").trim();
        if (!client || !problem || !work || !result) {
            throw new Error("Preencha todos os campos obrigatórios.");
        }
        const order = {
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            client,
            date: parseServiceDate(values.get("date")),
            arrival: parseServiceTime(values.get("arrival"), "a hora de chegada"),
            problem,
            work,
            result,
            departure: parseServiceTime(values.get("departure"), "a hora de saída"),
            comments: values.get("comments").trim(),
            attachments: selectedFiles.map((file) => ({ name: file.name, type: file.type, data: file })),
            syncState: accessToken ? "pending" : "local"
        };
        await saveOrder(order);
        form.reset();
        setSyncStatus(accessToken ? "Ordem salva — sincronizando com o Google Tasks." : "Ordem salva neste aparelho.", accessToken ? "connected" : "local");
        await renderOrders(await allOrders());
        if (accessToken) await syncPendingOrders();
    } catch (error) {
        formError.textContent = `Não foi possível salvar a ordem: ${error.message}`;
        formError.hidden = false;
    } finally {
        submitButton.disabled = false;
    }
});

ordersList.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    if (button.dataset.action === "history-txt" || button.dataset.action === "history-zip") {
        await exportHistory(button.dataset.action === "history-txt" ? "txt" : "zip");
        return;
    }

    const order = (await allOrders()).find((item) => item.id === button.dataset.id);
    if (!order) return;

    try {
        if (button.dataset.action === "txt") {
            downloadBlob(new Blob([orderText(order)], { type: "text/plain;charset=utf-8" }), `${safeFilename(order.client)}_${order.date}.txt`);
        } else if (button.dataset.action === "zip") {
            const files = [{ name: "ordem-de-servico.txt", data: orderText(order) }];
            order.attachments.forEach((file, index) => {
                files.push({ name: `anexos/${String(index + 1).padStart(2, "0")}_${safeAttachmentName(file.name)}`, data: file.data });
            });
            downloadBlob(await createZip(files), `${safeFilename(order.client)}_${order.date}.zip`);
        } else if (button.dataset.action === "sync") {
            button.disabled = true;
            await syncOrder(order);
            setSyncStatus("Ordem sincronizada com o Google Tasks.", "connected");
            await renderOrders(await allOrders());
        } else if (button.dataset.action === "delete") {
            if (!window.confirm(`Excluir a ordem de serviço de ${order.client} deste aparelho?`)) return;
            await deleteOrder(order.id);
            await renderOrders(await allOrders());
        }
    } catch (error) {
        setSyncStatus(`Não foi possível concluir a ação: ${error.message}`, "error");
    }
});

exportHistoryTxt.addEventListener("click", () => exportHistory("txt"));
exportHistoryZip.addEventListener("click", () => exportHistory("zip"));

connectButton.addEventListener("click", connectGoogle);
bindInputMasks();
window.addEventListener("online", () => {
    if (accessToken) syncPendingOrders().catch((error) => setSyncStatus(error.message, "error"));
});

async function startApp() {
    try {
        database = await openDatabase();
        await renderOrders(await allOrders());
    } catch (error) {
        form.querySelector('[type="submit"]').disabled = true;
        formError.textContent = `Armazenamento local indisponível: ${error.message}`;
        formError.hidden = false;
    }

    if ("serviceWorker" in navigator && location.protocol !== "file:") {
        navigator.serviceWorker.register("./sw.js").catch((error) => {
            setSyncStatus(`Não foi possível ativar o modo offline: ${error.message}`, "error");
        });
    }
}

startApp();
