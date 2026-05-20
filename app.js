// Importa os serviços especializados das subpastas
import { scanDirectory, saveFileToProject } from './services/fileService.js';
import { packProject, splitIntoBlocks, unpackIAResponse } from './services/cryptoService.js';

// Estado global da aplicação (memoriza a pasta aberta e os blocos gerados)
let rootDirectoryHandle = null;
let mappedFiles = [];
let generatedBlocks = [];
let currentBlockIndex = 0;

/* ==========================================================================
   MAPEAMENTO DE ELEMENTOS DA INTERFACE (DOM)
   ========================================================================== */
const btnSelectFolder = document.getElementById('btn-select-folder');
const lblFolderPath = document.getElementById('folder-path');
const lstFileListTree = document.getElementById('file-list-tree');

const btnGenerateBlocks = document.getElementById('btn-generate-blocks');
const lblBlockInfo = document.getElementById('block-info');
const divPagination = document.getElementById('block-pagination');
const txtIaOutput = document.getElementById('txt-ia-output');
const btnCopyBlock = document.getElementById('btn-copy-block');

const txtIaInput = document.getElementById('txt-ia-input');
const btnApplyChanges = document.getElementById('btn-apply-changes');

/* ==========================================================================
   LOGICA DA ETAPA 1: SELEÇÃO E LEITURA DA PASTA
   ========================================================================== */
btnSelectFolder.addEventListener('click', async () => {
    try {
        // Abre a janela nativa do sistema para escolher a pasta
        rootDirectoryHandle = await window.showDirectoryPicker({
            mode: 'readwrite' // Pede permissão para ler e escrever mudanças
        });

        lblFolderPath.textContent = `Ativo: ${rootDirectoryHandle.name}`;
        lstFileListTree.innerHTML = '<li>Escaneando arquivos...</li>';

        // Escaneia os arquivos usando o serviço
        mappedFiles = await scanDirectory(rootDirectoryHandle);

        // Renderiza a lista de arquivos na tela para o usuário ver
        lstFileListTree.innerHTML = '';
        if (mappedFiles.length === 0) {
            lstFileListTree.innerHTML = '<li>Nenhum arquivo de código válido encontrado.</li>';
            btnGenerateBlocks.disabled = true;
            return;
        }

        mappedFiles.forEach(file => {
            const li = document.createElement('li');
            li.textContent = `📄 ${file.path}`;
            lstFileListTree.appendChild(li);
        });

        // Libera o próximo passo do aplicativo
        btnGenerateBlocks.disabled = false;
        lblBlockInfo.textContent = `${mappedFiles.length} arquivos prontos.`;

    } catch (error) {
        console.error('Erro ao selecionar pasta:', error);
        lblFolderPath.textContent = 'Seleção cancelada ou sem permissão.';
    }
});

/* ==========================================================================
   LOGICA DA ETAPA 2: GERAÇÃO E PAGINAÇÃO DOS BLOCOS PARA A IA
   ========================================================================== */
btnGenerateBlocks.addEventListener('click', () => {
    if (mappedFiles.length === 0) return;

    // 1. Empacota o projeto em uma string gigante estruturada
    const fullPackedText = packProject(mappedFiles);

    // 2. Quebra o texto respeitando o limite do chat
    generatedBlocks = splitIntoBlocks(fullPackedText);
    currentBlockIndex = 0;

    lblBlockInfo.textContent = `Projeto dividido em ${generatedBlocks.length} bloco(s).`;
    
    // 3. Monta os botões de paginação na interface
    renderPagination();
    // 4. Mostra o primeiro bloco na caixa de texto
    showBlock(0);

    btnCopyBlock.disabled = false;
});

function renderPagination() {
    divPagination.innerHTML = '';
    generatedBlocks.forEach((_, index) => {
        const chip = document.createElement('span');
        chip.classList.add('page-chip');
        if (index === currentBlockIndex) chip.classList.add('active');
        chip.textContent = `${index + 1}`;
        
        chip.addEventListener('click', () => {
            document.querySelectorAll('.page-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            showBlock(index);
        });
        
        divPagination.appendChild(chip);
    });
}

function showBlock(index) {
    currentBlockIndex = index;
    txtIaOutput.value = generatedBlocks[index];
}

// Botão rápido para copiar o bloco de texto atual
btnCopyBlock.addEventListener('click', () => {
    if (!txtIaOutput.value) return;
    navigator.clipboard.writeText(txtIaOutput.value);
    
    const originalText = btnCopyBlock.textContent;
    btnCopyBlock.textContent = '¡Copiado com sucesso!';
    btnCopyBlock.style.backgroundColor = '#10b981';
    
    setTimeout(() => {
        btnCopyBlock.textContent = originalText;
        btnCopyBlock.style.backgroundColor = '';
    }, 2000);
});

/* ==========================================================================
   LOGICA DA ETAPA 3: RECEPÇÃO DA IA E GRAVAÇÃO LOCAL
   ========================================================================== */
// Libera o botão de salvar apenas se o usuário colar algo
txtIaInput.addEventListener('input', () => {
    btnApplyChanges.disabled = txtIaInput.value.trim().length === 0;
});

btnApplyChanges.addEventListener('click', async () => {
    if (!rootDirectoryHandle) {
        alert('Por favor, selecione a pasta do projeto novamente na Etapa 1.');
        return;
    }

    const incomingText = txtIaInput.value;
    
    // Desempacota o texto da IA procurando os marcadores de arquivo
    const updates = unpackIAResponse(incomingText);

    if (updates.length === 0) {
        alert('Nenhum arquivo modificado foi detectado no texto colado. Certifique-se de que a IA usou as marcações nativas do protocolo.');
        return;
    }

    try {
        // Grava cada arquivo modificado de volta na pasta do computador
        for (const file of updates) {
            await saveFileToProject(rootDirectoryHandle, file.path, file.content);
        }

        alert(`Sucesso! ${updates.length} arquivo(s) foram atualizados ou criados no seu computador.`);
        txtIaInput.value = '';
        btnApplyChanges.disabled = true;

        // Atualiza a árvore visual relendo a pasta
        mappedFiles = await scanDirectory(rootDirectoryHandle);
        lstFileListTree.innerHTML = '';
        mappedFiles.forEach(file => {
            const li = document.createElement('li');
            li.textContent = `📄 ${file.path}`;
            lstFileListTree.appendChild(li);
        });

    } catch (error) {
        console.error('Erro ao gravar arquivos:', error);
        alert('Falha ao gravar arquivos. Verifique se o navegador ainda tem permissão de escrita na pasta.');
    }
});
