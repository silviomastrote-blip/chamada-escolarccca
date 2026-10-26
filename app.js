// =============================================================================
// app.js — Frontend Responsivo para Vercel (Client-Side Storage)
// =============================================================================

const toastEl = document.getElementById('toast');
const app = document.getElementById('app');

// Inicialização e Mock Database LocalStorage
const DB_KEY = 'ccca_chamada_db';

function getDB() {
  const data = localStorage.getItem(DB_KEY);
  if (data) return JSON.parse(data);

  // Dados iniciais de teste caso o banco esteja vazio
  const initialDB = {
    usuarios: [
      { id: 1, nome: "Administrador", usuario: "admin", senha: "123", role: "admin" },
      { id: 2, nome: "Prof. Carlos Santos", usuario: "prof1", senha: "123", role: "professor", disciplina: "Matemática" },
      { id: 3, nome: "Prof. Ana Souza", usuario: "prof2", senha: "123", role: "professor", disciplina: "Português" }
    ],
    turmas: [
      { id: 101, nome: "6º Ano A", dia_semana: "Segunda", horario: "08:00 - 09:40", professor_id: 2, professor_nome: "Prof. Carlos Santos" },
      { id: 102, nome: "7º Ano B", dia_semana: "Terça", horario: "10:00 - 11:40", professor_id: 3, professor_nome: "Prof. Ana Souza" }
    ],
    alunos: [
      { id: 1001, nome: "Arthur Silva", turma_id: 101 },
      { id: 1002, nome: "Beatriz Lima", turma_id: 101 },
      { id: 1003, nome: "Caio Costa", turma_id: 102 }
    ],
    avisos: [
      { id: 1, texto: "Reunião de pais agendada para a próxima sexta-feira às 18h.", criado_em: "2026-10-20" }
    ],
    chamadas: [] // formato: { turma_id, data, registros: [{ aluno_id, presente }] }
  };
  localStorage.setItem(DB_KEY, JSON.stringify(initialDB));
  return initialDB;
}

function saveDB(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

let usuarioAtual = JSON.parse(sessionStorage.getItem('usuarioAtual') || 'null');
let turmaSelecionada = null;

// Helper global de clonagem de template
function clone(tplId) {
  return document.getElementById(tplId).content.cloneNode(true);
}

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.remove('opacity-0');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toastEl.classList.add('opacity-0'), 2500);
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

// -----------------------------------------------------------------------------
// TEMA ESCURO
// -----------------------------------------------------------------------------
const btnDark = document.getElementById('btn-dark-toggle');
function aplicarTema() {
  const escuro = localStorage.getItem('tema') === 'escuro';
  document.documentElement.classList.toggle('dark', escuro);
  btnDark.textContent = escuro ? '☀️' : '🌙';
}
btnDark.addEventListener('click', () => {
  const escuroAtual = document.documentElement.classList.contains('dark');
  localStorage.setItem('tema', escuroAtual ? 'claro' : 'escuro');
  aplicarTema();
});
aplicarTema();

// -----------------------------------------------------------------------------
// LOGOUT & ROTAS
// -----------------------------------------------------------------------------
document.getElementById('btn-logout').addEventListener('click', () => {
  usuarioAtual = null;
  sessionStorage.removeItem('usuarioAtual');
  render();
});

function render() {
  const logoutBtn = document.getElementById('btn-logout');
  const nomeSpan = document.getElementById('usuario-logado');

  if (!usuarioAtual) {
    logoutBtn.classList.add('hidden');
    nomeSpan.textContent = '';
    renderLogin();
    return;
  }

  logoutBtn.classList.remove('hidden');
  nomeSpan.textContent = `${usuarioAtual.nome} (${usuarioAtual.role})`;

  if (usuarioAtual.role === 'admin') renderAdminHome();
  else renderProfessorHome();
}

// -----------------------------------------------------------------------------
// TELA DE LOGIN
// -----------------------------------------------------------------------------
function renderLogin() {
  app.innerHTML = '';
  app.appendChild(clone('tpl-login'));

  document.getElementById('form-login').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const u = fd.get('usuario');
    const s = fd.get('senha');
    const erroEl = document.getElementById('login-erro');

    const db = getDB();
    const user = db.usuarios.find(x => x.usuario === u && x.senha === s);

    if (user) {
      usuarioAtual = user;
      sessionStorage.setItem('usuarioAtual', JSON.stringify(user));
      render();
    } else {
      erroEl.textContent = 'Usuário ou senha incorretos!';
      erroEl.classList.remove('hidden');
    }
  });
}

// -----------------------------------------------------------------------------
// PAINEL PROFESSOR
// -----------------------------------------------------------------------------
function renderProfessorHome() {
  app.innerHTML = '';
  app.appendChild(clone('tpl-professor-home'));

  const db = getDB();

  // Mural de avisos
  const muralEl = document.getElementById('mural');
  muralEl.innerHTML = db.avisos.map(a => `
    <div class="bg-amber-500/10 border border-amber-500/30 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 flex gap-2 items-start">
      <span class="text-base leading-none">📌</span>
      <p class="text-xs">${escapeHtml(a.texto)}</p>
    </div>
  `).join('') || '<p class="text-xs text-slate-400">Nenhum aviso no momento.</p>';

  // Turmas do professor
  const turmas = db.turmas.filter(t => t.professor_id == usuarioAtual.id);
  const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const hojeNome = diasSemana[new Date().getDay()];
  
  document.getElementById('dia-atual').textContent = `Hoje é ${hojeNome}`;

  const listaEl = document.getElementById('lista-turmas');
  if (turmas.length === 0) {
    listaEl.innerHTML = '<p class="text-slate-500 text-xs">Nenhuma turma associada a este professor.</p>';
    return;
  }

  turmas.forEach(t => {
    const card = clone('tpl-turma-card');
    card.querySelector('p.font-bold').textContent = t.nome;
    card.querySelector('.turma-horario').textContent = `${t.dia_semana} • ${t.horario}`;
    card.querySelector('button').addEventListener('click', () => renderChamada(t));
    listaEl.appendChild(card);
  });
}

// -----------------------------------------------------------------------------
// TELA DE CHAMADA
// -----------------------------------------------------------------------------
function renderChamada(turma) {
  turmaSelecionada = turma;
  const data = hojeISO();
  const db = getDB();

  app.innerHTML = '';
  app.appendChild(clone('tpl-chamada'));
  document.getElementById('chamada-titulo').textContent = turma.nome;
  document.getElementById('chamada-data').textContent = new Date().toLocaleDateString('pt-BR');
  document.getElementById('btn-voltar-turmas').addEventListener('click', renderProfessorHome);

  const alunos = db.alunos.filter(a => a.turma_id == turma.id);
  const chamadaExistente = db.chamadas.find(c => c.turma_id == turma.id && c.data === data);
  const registrosExistentes = chamadaExistente ? chamadaExistente.registros : [];

  const listaEl = document.getElementById('lista-chamada');
  listaEl.innerHTML = '';

  if (alunos.length === 0) {
    listaEl.innerHTML = '<p class="text-xs text-slate-400 p-4 text-center">Nenhum aluno cadastrado nesta turma.</p>';
    return;
  }

  alunos.forEach(a => {
    const linha = clone('tpl-aluno-linha');
    const wrap = linha.querySelector('.aluno-linha');
    wrap.dataset.alunoId = a.id;
    linha.querySelector('.aluno-nome').textContent = a.nome;

    const reg = registrosExistentes.find(r => r.aluno_id == a.id);
    const estado = reg ? reg.presente : null;

    marcarEstadoBotoes(wrap, estado);

    linha.querySelector('.btn-presente').addEventListener('click', () => marcarEstadoBotoes(wrap, 1));
    linha.querySelector('.btn-falta').addEventListener('click', () => marcarEstadoBotoes(wrap, 0));

    listaEl.appendChild(linha);
  });

  document.getElementById('btn-marcar-todos-presentes').addEventListener('click', () => {
    listaEl.querySelectorAll('.aluno-linha').forEach(l => marcarEstadoBotoes(l, 1));
  });

  document.getElementById('btn-salvar-chamada').addEventListener('click', () => {
    const registros = [...listaEl.querySelectorAll('.aluno-linha')].map(l => ({
      aluno_id: Number(l.dataset.alunoId),
      presente: l.dataset.presente === '1' ? 1 : 0
    }));

    const idx = db.chamadas.findIndex(c => c.turma_id == turma.id && c.data === data);
    if (idx >= 0) {
      db.chamadas[idx].registros = registros;
    } else {
      db.chamadas.push({ turma_id: turma.id, data, registros });
    }

    saveDB(db);
    toast('Chamada salva com sucesso!');
  });
}

function marcarEstadoBotoes(linhaEl, presente) {
  linhaEl.dataset.presente = presente === 1 || presente === true ? '1' : (presente === 0 || presente === false ? '0' : '');
  const btnPresente = linhaEl.querySelector('.btn-presente');
  const btnFalta = linhaEl.querySelector('.btn-falta');

  const pAtivo = linhaEl.dataset.presente === '1';
  const fAtivo = linhaEl.dataset.presente === '0';

  btnPresente.className = `btn-presente btn-toggle w-20 py-2 rounded-lg text-xs font-bold transition ${pAtivo ? 'bg-emerald-600 text-white' : 'bg-transparent text-emerald-600 border border-emerald-600'}`;
  btnFalta.className = `btn-falta btn-toggle w-20 py-2 rounded-lg text-xs font-bold transition ${fAtivo ? 'bg-red-600 text-white' : 'bg-transparent text-red-600 border border-red-600'}`;
}

// -----------------------------------------------------------------------------
// PAINEL ADMIN
// -----------------------------------------------------------------------------
let abaAtual = 'geral';

function renderAdminHome() {
  app.innerHTML = '';
  app.appendChild(clone('tpl-admin-home'));

  document.querySelectorAll('.admin-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      abaAtual = btn.dataset.tab;
      atualizarAbasVisuais();
      renderAbaAdmin();
    });
  });

  atualizarAbasVisuais();
  renderAbaAdmin();
}

function atualizarAbasVisuais() {
  document.querySelectorAll('.admin-tab').forEach(btn => {
    const ativo = btn.dataset.tab === abaAtual;
    btn.className = `admin-tab px-3.5 py-2 rounded-xl transition shadow-sm shrink-0 font-bold ${ativo ? 'bg-brand text-white' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`;
  });
}

function renderAbaAdmin() {
  if (abaAtual === 'geral') return montarVisaoGeral();
  if (abaAtual === 'relatorios') return montarRelatorios();

  const config = {
    professores: configProfessores,
    turmas: configTurmas,
    alunos: configAlunos,
    avisos: configAvisos
  }[abaAtual];

  montarSecaoAdmin(config);
}

// ----------------------- Visão Geral Admin -----------------------
function montarVisaoGeral() {
  const destino = document.getElementById('admin-conteudo');
  destino.innerHTML = '';
  destino.appendChild(clone('tpl-admin-visao-geral'));

  const db = getDB();

  document.getElementById('vg-total-professores').textContent = db.usuarios.filter(u => u.role === 'professor').length;
  document.getElementById('vg-total-turmas').textContent = db.turmas.length;
  document.getElementById('vg-total-alunos').textContent = db.alunos.length;
  document.getElementById('vg-total-avisos').textContent = db.avisos.length;

  function desenhar(consulta) {
    const q = (consulta || '').toLowerCase();

    // Professores
    const profs = db.usuarios.filter(u => u.role === 'professor' && u.nome.toLowerCase().includes(q));
    document.getElementById('vg-professores').innerHTML = profs.map(p => `
      <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-700/50 text-xs flex justify-between items-center">
        <div>
          <p class="font-bold">${escapeHtml(p.nome)}</p>
          <p class="text-slate-400">Usuário: ${escapeHtml(p.usuario)} • Discp: ${escapeHtml(p.disciplina || '-')}</p>
        </div>
      </div>
    `).join('') || '<p class="text-xs text-slate-400">Nenhum professor encontrado.</p>';

    // Turmas
    const turmas = db.turmas.filter(t => t.nome.toLowerCase().includes(q));
    document.getElementById('vg-turmas').innerHTML = turmas.map(t => {
      const qtdAlunos = db.alunos.filter(a => a.turma_id == t.id).length;
      return `
        <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-700/50 text-xs flex justify-between items-center">
          <div>
            <p class="font-bold">${escapeHtml(t.nome)}</p>
            <p class="text-slate-400">${escapeHtml(t.dia_semana)} (${escapeHtml(t.horario)}) • Prof: ${escapeHtml(t.professor_nome)}</p>
          </div>
          <span class="bg-brand/10 text-brand dark:text-white px-2 py-0.5 rounded-full font-bold">${qtdAlunos} Alunos</span>
        </div>
      `;
    }).join('') || '<p class="text-xs text-slate-400">Nenhuma turma encontrada.</p>';

    // Alunos sem Turma
    const semTurma = db.alunos.filter(a => !db.turmas.some(t => t.id == a.turma_id));
    document.getElementById('vg-sem-turma').innerHTML = semTurma.map(a => `
      <div class="p-2 rounded-lg bg-slate-50 dark:bg-slate-700/30 text-xs font-semibold">
        ${escapeHtml(a.nome)}
      </div>
    `).join('') || '<p class="text-xs text-slate-400">Todos os alunos estão alocados em turmas.</p>';

    // Avisos
    document.getElementById('vg-avisos').innerHTML = db.avisos.map(a => `
      <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-700/50 text-xs">
        <p>${escapeHtml(a.texto)}</p>
      </div>
    `).join('') || '<p class="text-xs text-slate-400">Nenhum aviso publicado.</p>';
  }

  const busca = document.getElementById('vg-busca');
  busca.addEventListener('input', () => desenhar(busca.value));
  desenhar('');

  // Formulário Rápido de Aluno
  const formGlobal = document.getElementById('vg-form-aluno');
  const selTurma = document.getElementById('vg-novo-turma');
  selTurma.innerHTML = db.turmas.map(t => `<option value="${t.id}">${escapeHtml(t.nome)}</option>`).join('');

  document.getElementById('vg-btn-novo-aluno').addEventListener('click', () => formGlobal.classList.toggle('hidden'));
  document.querySelector('.vg-fechar-form').addEventListener('click', () => formGlobal.classList.add('hidden'));

  formGlobal.addEventListener('submit', (e) => {
    e.preventDefault();
    const nome = document.getElementById('vg-novo-nome').value.trim();
    const turma_id = Number(selTurma.value);

    if (nome) {
      db.alunos.push({ id: Date.now(), nome, turma_id });
      saveDB(db);
      toast('Aluno Adicionado!');
      formGlobal.reset();
      formGlobal.classList.add('hidden');
      montarVisaoGeral();
    }
  });
}

// ----------------------- Seções Admin CRUD Generico -----------------------
function montarSecaoAdmin(config) {
  const destino = document.getElementById('admin-conteudo');
  destino.innerHTML = '';
  destino.appendChild(clone('tpl-admin-secao'));

  document.getElementById('secao-titulo').textContent = config.titulo;
  document.getElementById('tabela-cabecalho').innerHTML =
    config.colunas.map(c => `<th class="py-2 pr-3 font-semibold">${c.label}</th>`).join('') + '<th class="py-2 text-right">Ações</th>';

  const formWrap = document.getElementById('secao-form-wrap');
  const btnNovo = document.getElementById('btn-novo');

  function carregarLista() {
    const db = getDB();
    const itens = config.listar(db);
    const corpo = document.getElementById('tabela-corpo');

    corpo.innerHTML = itens.map(item => `
      <tr class="border-b border-slate-100 dark:border-slate-700/60">
        ${config.colunas.map(c => `<td class="py-2.5 pr-3 text-slate-700 dark:text-slate-300">${escapeHtml(item[c.campo] ?? '-')}</td>`).join('')}
        <td class="py-2.5 text-right space-x-2">
          <button data-id="${item.id}" class="btn-editar text-brand dark:text-white font-bold">Editar</button>
          <button data-id="${item.id}" class="btn-excluir text-red-600 font-bold">Excluir</button>
        </td>
      </tr>
    `).join('') || `<tr><td colspan="${config.colunas.length + 1}" class="py-4 text-center text-slate-400">Nenhum registro encontrado.</td></tr>`;

    corpo.querySelectorAll('.btn-editar').forEach(b =>
      b.addEventListener('click', () => abrirFormulario(itens.find(i => i.id == b.dataset.id)))
    );
    corpo.querySelectorAll('.btn-excluir').forEach(b =>
      b.addEventListener('click', () => {
        if (confirm('Deseja realmente excluir este registro?')) {
          config.excluir(getDB(), b.dataset.id);
          toast('Registro excluído!');
          carregarLista();
        }
      })
    );
  }

  function abrirFormulario(itemExistente) {
    const db = getDB();
    formWrap.classList.remove('hidden');
    formWrap.innerHTML = config.formularioHtml(db, itemExistente);

    formWrap.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const dados = Object.fromEntries(new FormData(e.target).entries());
      const localDB = getDB();
      if (itemExistente) {
        config.editar(localDB, itemExistente.id, dados);
      } else {
        config.criar(localDB, dados);
      }
      toast('Registro salvo!');
      formWrap.classList.add('hidden');
      carregarLista();
    });

    formWrap.querySelector('.btn-cancelar').addEventListener('click', () => formWrap.classList.add('hidden'));
  }

  btnNovo.addEventListener('click', () => abrirFormulario(null));
  carregarLista();
}

// Configurações CRUD
const configProfessores = {
  titulo: 'Gerenciar Professores',
  colunas: [{ campo: 'nome', label: 'Nome' }, { campo: 'usuario', label: 'Usuário' }, { campo: 'disciplina', label: 'Disciplina' }],
  listar: (db) => db.usuarios.filter(u => u.role === 'professor'),
  criar: (db, d) => { db.usuarios.push({ id: Date.now(), ...d, role: 'professor' }); saveDB(db); },
  editar: (db, id, d) => { const idx = db.usuarios.findIndex(u => u.id == id); db.usuarios[idx] = { ...db.usuarios[idx], ...d }; saveDB(db); },
  excluir: (db, id) => { db.usuarios = db.usuarios.filter(u => u.id != id); saveDB(db); },
  formularioHtml: (db, item) => `
    <form class="space-y-3">
      <div class="grid sm:grid-cols-2 gap-2">
        <input name="nome" value="${escapeHtml(item?.nome || '')}" placeholder="Nome Completo" required class="rounded-lg border p-2 text-xs dark:bg-slate-700"/>
        <input name="usuario" value="${escapeHtml(item?.usuario || '')}" placeholder="Login" required class="rounded-lg border p-2 text-xs dark:bg-slate-700"/>
        <input name="senha" type="password" value="${escapeHtml(item?.senha || '123')}" placeholder="Senha" required class="rounded-lg border p-2 text-xs dark:bg-slate-700"/>
        <input name="disciplina" value="${escapeHtml(item?.disciplina || '')}" placeholder="Disciplina" required class="rounded-lg border p-2 text-xs dark:bg-slate-700"/>
      </div>
      <div class="flex gap-2">
        <button type="submit" class="bg-brand text-white text-xs font-bold px-4 py-2 rounded-lg">Salvar</button>
        <button type="button" class="btn-cancelar bg-slate-300 text-slate-800 text-xs px-4 py-2 rounded-lg">Cancelar</button>
      </div>
    </form>`
};

const configTurmas = {
  titulo: 'Gerenciar Turmas',
  colunas: [{ campo: 'nome', label: 'Nome' }, { campo: 'dia_semana', label: 'Dia' }, { campo: 'horario', label: 'Horário' }, { campo: 'professor_nome', label: 'Professor' }],
  listar: (db) => db.turmas,
  criar: (db, d) => {
    const prof = db.usuarios.find(u => u.id == d.professor_id);
    db.turmas.push({ id: Date.now(), ...d, professor_nome: prof ? prof.nome : '' });
    saveDB(db);
  },
  editar: (db, id, d) => {
    const idx = db.turmas.findIndex(t => t.id == id);
    const prof = db.usuarios.find(u => u.id == d.professor_id);
    db.turmas[idx] = { ...db.turmas[idx], ...d, professor_nome: prof ? prof.nome : '' };
    saveDB(db);
  },
  excluir: (db, id) => { db.turmas = db.turmas.filter(t => t.id != id); saveDB(db); },
  formularioHtml: (db, item) => {
    const profs = db.usuarios.filter(u => u.role === 'professor');
    return `
    <form class="space-y-3">
      <div class="grid sm:grid-cols-2 gap-2">
        <input name="nome" value="${escapeHtml(item?.nome || '')}" placeholder="Nome da Turma" required class="rounded-lg border p-2 text-xs dark:bg-slate-700"/>
        <input name="horario" value="${escapeHtml(item?.horario || '')}" placeholder="Horário (ex: 08:00 - 09:40)" required class="rounded-lg border p-2 text-xs dark:bg-slate-700"/>
        <select name="dia_semana" class="rounded-lg border p-2 text-xs dark:bg-slate-700">
          ${['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'].map(d => `<option value="${d}" ${item?.dia_semana === d ? 'selected' : ''}>${d}</option>`).join('')}
        </select>
        <select name="professor_id" class="rounded-lg border p-2 text-xs dark:bg-slate-700">
          ${profs.map(p => `<option value="${p.id}" ${item?.professor_id == p.id ? 'selected' : ''}>${escapeHtml(p.nome)}</option>`).join('')}
        </select>
      </div>
      <div class="flex gap-2">
        <button type="submit" class="bg-brand text-white text-xs font-bold px-4 py-2 rounded-lg">Salvar</button>
        <button type="button" class="btn-cancelar bg-slate-300 text-slate-800 text-xs px-4 py-2 rounded-lg">Cancelar</button>
      </div>
    </form>`;
  }
};

const configAlunos = {
  titulo: 'Gerenciar Alunos',
  colunas: [{ campo: 'nome', label: 'Nome' }],
  listar: (db) => db.alunos,
  criar: (db, d) => { db.alunos.push({ id: Date.now(), ...d }); saveDB(db); },
  editar: (db, id, d) => { const idx = db.alunos.findIndex(a => a.id == id); db.alunos[idx] = { ...db.alunos[idx], ...d }; saveDB(db); },
  excluir: (db, id) => { db.alunos = db.alunos.filter(a => a.id != id); saveDB(db); },
  formularioHtml: (db, item) => `
    <form class="space-y-3">
      <div class="grid sm:grid-cols-2 gap-2">
        <input name="nome" value="${escapeHtml(item?.nome || '')}" placeholder="Nome do Aluno" required class="rounded-lg border p-2 text-xs dark:bg-slate-700"/>
        <select name="turma_id" class="rounded-lg border p-2 text-xs dark:bg-slate-700">
          ${db.turmas.map(t => `<option value="${t.id}" ${item?.turma_id == t.id ? 'selected' : ''}>${escapeHtml(t.nome)}</option>`).join('')}
        </select>
      </div>
      <div class="flex gap-2">
        <button type="submit" class="bg-brand text-white text-xs font-bold px-4 py-2 rounded-lg">Salvar</button>
        <button type="button" class="btn-cancelar bg-slate-300 text-slate-800 text-xs px-4 py-2 rounded-lg">Cancelar</button>
      </div>
    </form>`
};

const configAvisos = {
  titulo: 'Gerenciar Mural de Avisos',
  colunas: [{ campo: 'texto', label: 'Mensagem de Aviso' }],
  listar: (db) => db.avisos,
  criar: (db, d) => { db.avisos.push({ id: Date.now(), ...d, criado_em: hojeISO() }); saveDB(db); },
  editar: (db, id, d) => { const idx = db.avisos.findIndex(a => a.id == id); db.avisos[idx] = { ...db.avisos[idx], ...d }; saveDB(db); },
  excluir: (db, id) => { db.avisos = db.avisos.filter(a => a.id != id); saveDB(db); },
  formularioHtml: (db, item) => `
    <form class="space-y-3">
      <textarea name="texto" placeholder="Escreva o aviso..." required class="w-full rounded-lg border p-2 text-xs dark:bg-slate-700">${escapeHtml(item?.texto || '')}</textarea>
      <div class="flex gap-2">
        <button type="submit" class="bg-brand text-white text-xs font-bold px-4 py-2 rounded-lg">Salvar</button>
        <button type="button" class="btn-cancelar bg-slate-300 text-slate-800 text-xs px-4 py-2 rounded-lg">Cancelar</button>
      </div>
    </form>`
};

// ----------------------- Relatórios & Exportação -----------------------
function montarRelatorios() {
  const destino = document.getElementById('admin-conteudo');
  destino.innerHTML = '';
  destino.appendChild(clone('tpl-admin-relatorios'));

  const db = getDB();
  const selectTurma = document.getElementById('rel-turma');

  db.turmas.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.nome;
    selectTurma.appendChild(opt);
  });

  function gerarDadosRelatorio() {
    const turmaId = selectTurma.value;
    const inicio = document.getElementById('rel-data-inicio').value;
    const fim = document.getElementById('rel-data-fim').value;

    return db.chamadas.filter(c => {
      if (turmaId && c.turma_id != turmaId) return false;
      if (inicio && c.data < inicio) return false;
      if (fim && c.data > fim) return false;
      return true;
    });
  }

  // Exportação CSV
  document.getElementById('btn-exportar-csv').addEventListener('click', () => {
    const chamadas = gerarDadosRelatorio();
    if (chamadas.length === 0) return toast('Nenhum dado encontrado para os filtros selecionados.');

    let csvContent = "data:text/csv;charset=utf-8,Data,Turma,Aluno,Status\n";

    chamadas.forEach(c => {
      const turma = db.turmas.find(t => t.id == c.turma_id);
      c.registros.forEach(r => {
        const aluno = db.alunos.find(a => a.id == r.aluno_id);
        const status = r.presente === 1 ? 'Presente' : 'Falta';
        csvContent += `"${c.data}","${turma ? turma.nome : ''}","${aluno ? aluno.nome : ''}","${status}"\n`;
      });
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio_frequencia_${hojeISO()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  // Imprimir/Salvar PDF
  document.getElementById('btn-imprimir-relatorio').addEventListener('click', () => {
    window.print();
  });
}

// Start
render();