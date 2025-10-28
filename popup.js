// Popup script ultra-simplificado para Procesador de opciones
console.log("Procesador de opciones Popup - Cargado");

class PopupManager {
  constructor() {
    console.log("Inicializando PopupManager...");
    this.isLoading = false;
    this.init();
  }

  async init() {
    console.log("Inicializando popup...");

    try {
      // Verificar que operationsProcessor esté disponible
      if (!window.operationsProcessor) {
        console.error("OperationsProcessor no está disponible");
        this.showError(
          "Error: OperationsProcessor no está disponible. Recarga la extensión."
        );
        return;
      }

      console.log("OperationsProcessor encontrado");

      // Cargar configuración
      await window.operationsProcessor.loadConfig();
      console.log("Configuración cargada");

      // Configurar event listeners
      this.setupEventListeners();
      console.log("Event listeners configurados");

      // Cargar UI
      this.loadConfigToUI();
      console.log("UI cargada");

      // Setup instruments sync UI (Phase 4 - US2)
      await this.setupInstrumentsSyncUI();
      console.log("Instruments sync UI configurada");

      // Verificar datos guardados con un pequeño delay para asegurar que todo esté listo
      setTimeout(async () => {
        console.log("Iniciando verificación de datos guardados...");
        await this.checkSavedData();
        console.log("Datos guardados verificados");
      }, 200);

      console.log("Popup inicializado correctamente");
    } catch (e) {
      console.error("Error inicializando popup:", e);
      this.showError("Error inicializando la extensión: " + e.message);
    }
  }

  setupEventListeners() {
    // Pestañas principales
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        this.switchMainTab(e.target.dataset.tab);
      });
    });

    // Pestañas de vista previa
    document.querySelectorAll(".preview-tab-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        this.switchPreviewTab(e.target.dataset.tab);
      });
    });

    // Configuración
    const symbolSelect = document.getElementById("symbolSelect");
    const expirationSelect = document.getElementById("expirationSelect");
    const useAveraging = document.getElementById("useAveraging");

    if (symbolSelect) {
      symbolSelect.addEventListener("change", (e) => {
        window.operationsProcessor.setActiveSymbol(e.target.value);
      });
    }

    if (expirationSelect) {
      expirationSelect.addEventListener("change", (e) => {
        window.operationsProcessor.setExpiration(e.target.value);
      });
    }

    if (useAveraging) {
      useAveraging.addEventListener("change", (e) => {
        window.operationsProcessor.setUseAveraging(e.target.checked);
      });
    }

    // Archivo CSV
    const csvFileInput = document.getElementById("csvFileInput");
    if (csvFileInput) {
      csvFileInput.addEventListener("change", (e) => {
        this.enableProcessButton();
      });
    }

    // Botones principales
    const processBtn = document.getElementById("processOperationsBtn");
    if (processBtn) {
      processBtn.addEventListener("click", () => this.processOperations());
    }

    const clearBtn = document.getElementById("clearDataBtn");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => this.clearOperationsResults());
    }

    // Botones de resultados
    const downloadAllBtn = document.getElementById("downloadAllBtn");
    if (downloadAllBtn) {
      downloadAllBtn.addEventListener("click", () => this.downloadAllFile());
    }

    const copyCallsBtn = document.getElementById("copyCallsBtn");
    if (copyCallsBtn) {
      copyCallsBtn.addEventListener("click", () =>
        this.copyOperationsData("calls")
      );
    }

    const copyPutsBtn = document.getElementById("copyPutsBtn");
    if (copyPutsBtn) {
      copyPutsBtn.addEventListener("click", () =>
        this.copyOperationsData("puts")
      );
    }

    const downloadCallsBtn = document.getElementById("downloadCallsBtn");
    if (downloadCallsBtn) {
      downloadCallsBtn.addEventListener("click", () =>
        this.downloadCallsFile()
      );
    }

    const downloadPutsBtn = document.getElementById("downloadPutsBtn");
    if (downloadPutsBtn) {
      downloadPutsBtn.addEventListener("click", () => this.downloadPutsFile());
    }

    // Configuración avanzada
    const addSymbolBtn = document.getElementById("addSymbolBtn");
    if (addSymbolBtn) {
      addSymbolBtn.addEventListener("click", () => this.addSymbol());
    }

    const addExpirationBtn = document.getElementById("addExpirationBtn");
    if (addExpirationBtn) {
      addExpirationBtn.addEventListener("click", () => this.addExpiration());
    }

    const resetConfigBtn = document.getElementById("resetConfigBtn");
    if (resetConfigBtn) {
      resetConfigBtn.addEventListener("click", () => this.resetConfiguration());
    }

    const saveConfigBtn = document.getElementById("saveConfigBtn");
    if (saveConfigBtn) {
      saveConfigBtn.addEventListener("click", () => this.saveConfiguration());
    }
  }

  switchMainTab(tabName) {
    // Actualizar botones de pestañas
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tabName);
    });

    // Mostrar/ocultar contenido
    document.querySelectorAll(".tab-content").forEach((content) => {
      content.classList.toggle("active", content.id === tabName + "Tab");
    });
  }

  switchPreviewTab(tabName) {
    // Actualizar botones de pestañas
    document.querySelectorAll(".preview-tab-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tabName);
    });

    // Mostrar/ocultar contenido
    document.getElementById("previewCalls").style.display =
      tabName === "calls" ? "block" : "none";
    document.getElementById("previewPuts").style.display =
      tabName === "puts" ? "block" : "none";
  }

  loadConfigToUI() {
    if (this.isLoading) return;
    this.isLoading = true;

    try {
      // Cargar símbolos
      this.loadSymbolsToSelect();
      this.loadSymbolsList();

      // Cargar vencimientos
      this.loadExpirationsToSelect();
      this.loadExpirationsList();

      // Establecer valores
      const symbolSelect = document.getElementById("symbolSelect");
      const expirationSelect = document.getElementById("expirationSelect");
      const useAveraging = document.getElementById("useAveraging");

      if (symbolSelect) {
        symbolSelect.value = window.operationsProcessor.getActiveSymbol();
      }

      if (expirationSelect) {
        expirationSelect.value = window.operationsProcessor.getExpiration();
      }

      if (useAveraging) {
        useAveraging.checked = window.operationsProcessor.getUseAveraging();
      }
    } catch (error) {
      console.error("Error cargando configuración:", error);
    } finally {
      this.isLoading = false;
    }
  }

  loadSymbolsToSelect() {
    const symbolSelect = document.getElementById("symbolSelect");
    if (!symbolSelect) return;

    try {
      const symbols = window.operationsProcessor.getAvailableSymbols();
      if (!symbols || symbols.length === 0) return;

      // Solo actualizar si hay cambios
      const currentOptions = Array.from(symbolSelect.options).map(
        (opt) => opt.value
      );
      const hasChanged =
        symbols.length !== currentOptions.length ||
        symbols.some((symbol) => !currentOptions.includes(symbol));

      if (hasChanged) {
        symbolSelect.innerHTML = "";
        symbols.forEach((symbol) => {
          const option = document.createElement("option");
          option.value = symbol;
          option.textContent = symbol;
          symbolSelect.appendChild(option);
        });
      }
    } catch (error) {
      console.error("Error cargando símbolos:", error);
    }
  }

  loadExpirationsToSelect() {
    const expirationSelect = document.getElementById("expirationSelect");
    if (!expirationSelect) return;

    try {
      const expirations = window.operationsProcessor.getAvailableExpirations();
      if (!expirations || Object.keys(expirations).length === 0) return;

      // Solo actualizar si hay cambios
      const currentOptions = Array.from(expirationSelect.options).map(
        (opt) => opt.value
      );
      const expirationKeys = Object.keys(expirations);
      const hasChanged =
        expirationKeys.length !== currentOptions.length ||
        expirationKeys.some((key) => !currentOptions.includes(key));

      if (hasChanged) {
        expirationSelect.innerHTML = "";
        Object.keys(expirations).forEach((code) => {
          const option = document.createElement("option");
          option.value = code;
          option.textContent = `${code} - ${expirations[code].name}`;
          expirationSelect.appendChild(option);
        });
      }
    } catch (error) {
      console.error("Error cargando vencimientos:", error);
    }
  }

  loadSymbolsList() {
    const symbolsList = document.getElementById("symbolsList");
    if (!symbolsList) return;

    try {
      const symbols = window.operationsProcessor.getAvailableSymbols();
      symbolsList.innerHTML = "";

      if (symbols.length === 0) {
        symbolsList.innerHTML =
          '<div class="empty-state">No hay símbolos configurados</div>';
        return;
      }

      symbols.forEach((symbol) => {
        const item = document.createElement("div");
        item.className = "config-item";
        item.innerHTML = `
          <span>${symbol}</span>
          <button onclick="popupManager.removeSymbol('${symbol}')">Eliminar</button>
        `;
        symbolsList.appendChild(item);
      });
    } catch (error) {
      console.error("Error cargando lista de símbolos:", error);
    }
  }

  loadExpirationsList() {
    const expirationsList = document.getElementById("expirationsList");
    if (!expirationsList) return;

    try {
      const expirations = window.operationsProcessor.getAvailableExpirations();
      expirationsList.innerHTML = "";

      if (Object.keys(expirations).length === 0) {
        expirationsList.innerHTML =
          '<div class="empty-state">No hay vencimientos configurados</div>';
        return;
      }

      Object.keys(expirations).forEach((code) => {
        const item = document.createElement("div");
        item.className = "config-item";
        const suffixes = expirations[code].suffixes
          ? expirations[code].suffixes.join(", ")
          : "";
        item.innerHTML = `
          <div style="flex: 1;">
            <div style="font-weight: 500; margin-bottom: 4px;">${code} - ${
          expirations[code].name
        }</div>
            <div style="font-size: 12px; color: #6b7280;">
              <div><strong>Sufijos:</strong> ${suffixes || "N/A"}</div>
            </div>
          </div>
          <div style="display: flex; gap: 6px;">
            <button class="edit-expiration-btn" data-code="${code}" style="padding: 4px 8px; font-size: 11px; background: #8b5cf6; color: white; border: none; border-radius: 4px; cursor: pointer;">Editar</button>
            <button class="remove-expiration-btn" data-code="${code}" style="padding: 4px 8px; font-size: 11px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer;">Eliminar</button>
          </div>
        `;

        // Agregar event listeners
        const editBtn = item.querySelector(".edit-expiration-btn");
        const removeBtn = item.querySelector(".remove-expiration-btn");

        editBtn.addEventListener("click", () => {
          this.editExpiration(editBtn.dataset.code);
        });

        removeBtn.addEventListener("click", () => {
          this.removeExpiration(removeBtn.dataset.code);
        });

        expirationsList.appendChild(item);
      });
    } catch (error) {
      console.error("Error cargando lista de vencimientos:", error);
    }
  }

  enableProcessButton() {
    const processBtn = document.getElementById("processOperationsBtn");
    const csvFileInput = document.getElementById("csvFileInput");

    if (processBtn && csvFileInput) {
      processBtn.disabled = !csvFileInput.files[0];
    }
  }

  async processOperations() {
    const csvFileInput = document.getElementById("csvFileInput");
    const symbolSelect = document.getElementById("symbolSelect");
    const expirationSelect = document.getElementById("expirationSelect");
    const useAveraging = document.getElementById("useAveraging");
    const processBtn = document.getElementById("processOperationsBtn");

    if (!csvFileInput.files[0]) {
      this.showStatus("Selecciona un archivo CSV", "error");
      return;
    }

    try {
      processBtn.disabled = true;
      processBtn.textContent = "Procesando...";
      this.showStatus("Leyendo archivo CSV...", "info");

      const csvText = await this.readFileAsText(csvFileInput.files[0]);
      this.showStatus("Procesando operaciones...", "info");

      const result = await window.operationsProcessor.processCsvData(
        csvText,
        useAveraging.checked,
        symbolSelect.value,
        expirationSelect.value
      );

      if (result.success) {
        this.showStatus("Operaciones procesadas exitosamente", "success");
        this.displayOperationsResults(result);
        this.showResultsSection();
        await this.checkSavedData();
      } else {
        this.showStatus(`Error: ${result.error}`, "error");
      }
    } catch (error) {
      console.error("Error procesando operaciones:", error);
      this.showStatus(`Error procesando archivo: ${error.message}`, "error");
    } finally {
      processBtn.disabled = false;
      processBtn.textContent = "Procesar Operaciones";
    }
  }

  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error("Error leyendo archivo"));
      reader.readAsText(file);
    });
  }

  displayOperationsResults(result) {
    const summaryDiv = document.getElementById("operationsSummary");
    const callsTableBody = document.getElementById("callsTableBody");
    const putsTableBody = document.getElementById("putsTableBody");

    if (summaryDiv) {
      const symbolText = result.symbol || "N/A";
      const expirationText = result.expiration || "N/A";

      // Mostrar siempre las cantidades SIN promedios
      const totalOps = result.callsData.length + result.putsData.length;
      const callsCount = result.callsData.length;
      const putsCount = result.putsData.length;

      // Si hay promedios, mostrar también las cantidades originales
      const hasAveraging =
        result.useAveraging &&
        result.originalCallsCount &&
        result.originalPutsCount &&
        (result.originalCallsCount !== callsCount ||
          result.originalPutsCount !== putsCount);

      console.log("Display data:", {
        useAveraging: result.useAveraging,
        originalCallsCount: result.originalCallsCount,
        originalPutsCount: result.originalPutsCount,
        currentCallsCount: callsCount,
        currentPutsCount: putsCount,
      });

      let summaryHTML = `
        <div class="summary-item">
          <span class="summary-label">Modo:</span>
          <span class="summary-value" style="background: #8b5cf6; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">${
            result.useAveraging ? "CON PROMEDIOS" : "SIN PROMEDIOS"
          }</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Símbolo:</span>
          <span class="summary-value">${symbolText}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Vencimiento:</span>
          <span class="summary-value">${expirationText}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Total Operaciones:</span>
          <span class="summary-value">${
            hasAveraging && result.originalCallsCount
              ? result.originalCallsCount + result.originalPutsCount
              : totalOps
          }</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">CALLS:</span>
          <span class="summary-value">${
            hasAveraging && result.originalCallsCount
              ? result.originalCallsCount
              : callsCount
          }</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">PUTS:</span>
          <span class="summary-value">${
            hasAveraging && result.originalPutsCount
              ? result.originalPutsCount
              : putsCount
          }</span>
        </div>
      `;

      // Agregar caja de promedios si aplica
      if (hasAveraging) {
        summaryHTML += `
          <div style="margin-top: 16px; padding: 12px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px;">
            <div style="font-weight: 600; color: #1e40af; margin-bottom: 8px; font-size: 13px;">📊 CON PROMEDIOS APLICADOS:</div>
            <div class="summary-item">
              <span class="summary-label">Total Operaciones:</span>
              <span class="summary-value">${totalOps}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">CALLS:</span>
              <span class="summary-value">${callsCount}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">PUTS:</span>
              <span class="summary-value">${putsCount}</span>
            </div>
          </div>
        `;
      }

      summaryDiv.innerHTML = summaryHTML;
    }

    // Llenar tabla de CALLS
    if (callsTableBody) {
      callsTableBody.innerHTML = "";
      if (result.callsData.length > 0) {
        result.callsData.forEach((op) => {
          const row = document.createElement("tr");
          const cantidadClass = op.cantidad >= 0 ? "positive" : "negative";
          const precio4 = Number(op.precio).toFixed(4);
          row.innerHTML = `
            <td class="${cantidadClass}">${op.cantidad}</td>
            <td>${op.base}</td>
            <td>$${precio4}</td>
          `;
          callsTableBody.appendChild(row);
        });
      } else {
        const row = document.createElement("tr");
        row.innerHTML =
          '<td colspan="3" style="text-align: center; color: #6b7280;">No hay operaciones CALLS</td>';
        callsTableBody.appendChild(row);
      }
    }

    // Llenar tabla de PUTS
    if (putsTableBody) {
      putsTableBody.innerHTML = "";
      if (result.putsData.length > 0) {
        result.putsData.forEach((op) => {
          const row = document.createElement("tr");
          const cantidadClass = op.cantidad >= 0 ? "positive" : "negative";
          const precio4 = Number(op.precio).toFixed(4);
          row.innerHTML = `
            <td class="${cantidadClass}">${op.cantidad}</td>
            <td>${op.base}</td>
            <td>$${precio4}</td>
          `;
          putsTableBody.appendChild(row);
        });
      } else {
        const row = document.createElement("tr");
        row.innerHTML =
          '<td colspan="3" style="text-align: center; color: #6b7280;">No hay operaciones PUTS</td>';
        putsTableBody.appendChild(row);
      }
    }
  }

  showResultsSection() {
    const resultsSection = document.getElementById("resultsSection");
    if (resultsSection) {
      resultsSection.style.display = "block";
    }
  }

  async checkSavedData() {
    try {
      console.log("Verificando datos guardados...");

      // Verificar que operationsProcessor esté disponible
      if (!window.operationsProcessor) {
        console.error(
          "OperationsProcessor no está disponible en checkSavedData"
        );
        return;
      }

      // Forzar recarga de configuración para asegurar que tenemos los datos más recientes
      await window.operationsProcessor.loadConfig();

      console.log(
        "hasProcessedData:",
        window.operationsProcessor.hasProcessedData()
      );
      console.log(
        "callsData length:",
        window.operationsProcessor.callsData?.length || 0
      );
      console.log(
        "putsData length:",
        window.operationsProcessor.putsData?.length || 0
      );
      console.log(
        "processedData length:",
        window.operationsProcessor.processedData?.length || 0
      );

      // Verificar también directamente desde el storage
      const storageData = await chrome.storage.local.get([
        "callsData",
        "putsData",
        "processedData",
      ]);

      console.log("Datos directos del storage:", {
        callsDataLength: storageData.callsData?.length || 0,
        putsDataLength: storageData.putsData?.length || 0,
        processedDataLength: storageData.processedData?.length || 0,
      });

      if (
        window.operationsProcessor.hasProcessedData() ||
        (storageData.callsData && storageData.callsData.length > 0) ||
        (storageData.putsData && storageData.putsData.length > 0)
      ) {
        console.log("Hay datos procesados, mostrando...");
        const report = window.operationsProcessor.generateVisualReport();
        this.displaySavedDataInfo(report);
        this.showSavedDataSection();

        // También mostrar los resultados procesados
        await this.displaySavedResults();
        this.showResultsSection();
      } else {
        console.log("No hay datos procesados guardados");
      }
    } catch (error) {
      console.error("Error verificando datos guardados:", error);
    }
  }

  displaySavedDataInfo(report) {
    const savedDataInfo = document.getElementById("savedDataInfo");
    if (savedDataInfo) {
      // Verificar si el reporte tiene la estructura correcta
      if (report.error) {
        savedDataInfo.innerHTML = `<div class="status error">${report.error}</div>`;
        return;
      }

      // Usar la estructura correcta del reporte
      const resumen = report.resumen || {};
      const calls = report.calls || {};
      const puts = report.puts || {};

      savedDataInfo.innerHTML = `
        <strong>Última sesión procesada:</strong><br>
        Símbolo: ${resumen.simboloActivo || "N/A"}<br>
        Vencimiento: ${resumen.vencimiento || "N/A"}<br>
        Modo: ${resumen.modoPromedio ? "CON PROMEDIOS" : "SIN PROMEDIOS"}<br>
        CALLS: ${calls.count || 0} operaciones<br>
        PUTS: ${puts.count || 0} operaciones
      `;
    }
  }

  async displaySavedResults() {
    try {
      console.log("Mostrando resultados guardados...");

      // Verificar directamente el storage
      const storageData = await chrome.storage.local.get([
        "callsData",
        "putsData",
        "processedData",
        "activeSymbol",
        "expiration",
        "useAveraging",
      ]);

      console.log("Datos del storage:", storageData);
      console.log(
        "callsData desde storage:",
        storageData.callsData?.length || 0
      );
      console.log("putsData desde storage:", storageData.putsData?.length || 0);

      // Usar datos del storage directamente si están disponibles
      const callsData =
        storageData.callsData || window.operationsProcessor.callsData || [];
      const putsData =
        storageData.putsData || window.operationsProcessor.putsData || [];

      console.log("callsData final:", callsData);
      console.log("putsData final:", putsData);

      // Crear un objeto de resultado similar al que se genera al procesar
      const result = {
        symbol:
          storageData.activeSymbol ||
          window.operationsProcessor.getActiveSymbol(),
        expiration:
          storageData.expiration || window.operationsProcessor.getExpiration(),
        useAveraging:
          storageData.useAveraging !== undefined
            ? storageData.useAveraging
            : window.operationsProcessor.getUseAveraging(),
        callsData: callsData,
        putsData: putsData,
      };

      console.log("Resultado creado:", result);

      // Mostrar los resultados usando la misma función que se usa al procesar
      this.displayOperationsResults(result);
    } catch (error) {
      console.error("Error mostrando resultados guardados:", error);
    }
  }

  showSavedDataSection() {
    const savedDataSection = document.getElementById("savedDataSection");
    if (savedDataSection) {
      savedDataSection.style.display = "block";
    }
  }

  async downloadAllFile() {
    try {
      this.showStatus("Generando archivo...", "info");
      const filename = await window.operationsProcessor.generateExcelFile();
      this.showStatus(`Archivo descargado: ${filename}`, "success");
    } catch (error) {
      console.error("Error descargando archivo:", error);
      this.showStatus("Error generando archivo", "error");
    }
  }

  async copyOperationsData(type = "all") {
    try {
      this.showStatus("Copiando datos...", "info");
      const copyData = window.operationsProcessor.generateCopyData(type);
      await navigator.clipboard.writeText(copyData);
      this.showStatus("Datos copiados al portapapeles", "success");
    } catch (error) {
      console.error("Error copiando datos:", error);
      this.showStatus("Error copiando datos", "error");
    }
  }

  async downloadCallsFile() {
    try {
      this.showStatus("Generando archivo CALLS...", "info");
      const filename = await window.operationsProcessor.generateCallsFile();
      this.showStatus(`Archivo CALLS descargado: ${filename}`, "success");
    } catch (error) {
      console.error("Error descargando archivo CALLS:", error);
      this.showStatus("Error generando archivo CALLS", "error");
    }
  }

  async downloadPutsFile() {
    try {
      this.showStatus("Generando archivo PUTS...", "info");
      const filename = await window.operationsProcessor.generatePutsFile();
      this.showStatus(`Archivo PUTS descargado: ${filename}`, "success");
    } catch (error) {
      console.error("Error descargando archivo PUTS:", error);
      this.showStatus("Error generando archivo PUTS", "error");
    }
  }

  async clearOperationsResults() {
    if (confirm("¿Eliminar todos los datos procesados?")) {
      try {
        await window.operationsProcessor.clearProcessedData();

        // Limpiar UI
        document.getElementById("resultsSection").style.display = "none";
        document.getElementById("savedDataSection").style.display = "none";
        document.getElementById("csvFileInput").value = "";
        this.enableProcessButton();

        this.showStatus("Todos los datos eliminados correctamente", "success");
      } catch (error) {
        console.error("Error limpiando datos:", error);
        this.showStatus("Error limpiando datos", "error");
      }
    }
  }

  async addSymbol() {
    const newSymbolInput = document.getElementById("newSymbolInput");
    const symbol = newSymbolInput.value.trim();

    if (!symbol) {
      this.showStatus("Ingresa un símbolo válido", "error");
      return;
    }

    try {
      await window.operationsProcessor.addSymbol(symbol);
      newSymbolInput.value = "";
      this.loadSymbolsToSelect();
      this.loadSymbolsList();
      this.showStatus(`Símbolo ${symbol} agregado`, "success");
    } catch (error) {
      console.error("Error agregando símbolo:", error);
      this.showStatus("Error agregando símbolo", "error");
    }
  }

  async removeSymbol(symbol) {
    if (confirm(`¿Eliminar el símbolo ${symbol}?`)) {
      try {
        await window.operationsProcessor.removeSymbol(symbol);
        this.loadSymbolsToSelect();
        this.loadSymbolsList();
        this.showStatus(`Símbolo ${symbol} eliminado`, "success");
      } catch (error) {
        console.error("Error eliminando símbolo:", error);
        this.showStatus("Error eliminando símbolo", "error");
      }
    }
  }

  async addExpiration() {
    const nameInput = document.getElementById("newExpirationNameInput");
    const suffixesInput = document.getElementById("newExpirationSuffixesInput");

    const name = nameInput.value.trim();
    const suffixes = suffixesInput.value
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s);

    // Validaciones
    if (!name) {
      this.showStatus("Ingresa el nombre del mes", "error");
      return;
    }

    if (suffixes.length === 0) {
      this.showStatus("Ingresa al menos un sufijo", "error");
      return;
    }

    if (suffixes.length > 3) {
      this.showStatus("Máximo 3 sufijos permitidos", "error");
      return;
    }

    // Validar que no haya comas de más
    const originalSuffixes = suffixesInput.value.trim();
    if (originalSuffixes.endsWith(",") || originalSuffixes.startsWith(",")) {
      this.showStatus("No pongas comas al inicio o final", "error");
      return;
    }

    // Validar que no haya comas consecutivas
    if (originalSuffixes.includes(",,")) {
      this.showStatus("No pongas comas consecutivas", "error");
      return;
    }

    try {
      // Generar código automáticamente basado en el nombre del mes
      const monthCode = this.generateMonthCode(name);
      await window.operationsProcessor.addExpiration(monthCode, name, suffixes);
      nameInput.value = "";
      suffixesInput.value = "";
      this.loadExpirationsToSelect();
      this.loadExpirationsList();
      this.showStatus(`Vencimiento ${monthCode} agregado`, "success");
    } catch (error) {
      console.error("Error agregando vencimiento:", error);
      this.showStatus("Error agregando vencimiento", "error");
    }
  }

  generateMonthCode(monthName) {
    const monthMap = {
      enero: "ENE",
      febrero: "FEB",
      marzo: "MAR",
      abril: "ABR",
      mayo: "MAY",
      junio: "JUN",
      julio: "JUL",
      agosto: "AGO",
      septiembre: "SEP",
      octubre: "OCT",
      noviembre: "NOV",
      diciembre: "DIC",
    };
    return (
      monthMap[monthName.toLowerCase()] ||
      monthName.substring(0, 3).toUpperCase()
    );
  }

  async removeExpiration(code) {
    if (confirm(`¿Eliminar el vencimiento ${code}?`)) {
      try {
        await window.operationsProcessor.removeExpiration(code);
        this.loadExpirationsToSelect();
        this.loadExpirationsList();
        this.showStatus(`Vencimiento ${code} eliminado`, "success");
      } catch (error) {
        console.error("Error eliminando vencimiento:", error);
        this.showStatus("Error eliminando vencimiento", "error");
      }
    }
  }

  async resetConfiguration() {
    if (confirm("¿Restaurar la configuración por defecto?")) {
      try {
        await window.operationsProcessor.resetToDefaults();
        this.loadConfigToUI();
        this.showStatus("Configuración restaurada por defecto", "success");
      } catch (error) {
        console.error("Error restaurando configuración:", error);
        this.showStatus("Error restaurando configuración", "error");
      }
    }
  }

  async saveConfiguration() {
    try {
      await window.operationsProcessor.saveConfig();
      this.showStatus("Configuración guardada", "success");
    } catch (error) {
      console.error("Error guardando configuración:", error);
      this.showStatus("Error guardando configuración", "error");
    }
  }

  showStatus(message, type = "info") {
    const statusEl = document.getElementById("operationsStatus");
    if (statusEl) {
      statusEl.innerHTML = `<div class="status ${type}">${message}</div>`;

      if (type === "success") {
        setTimeout(() => {
          statusEl.innerHTML = "";
        }, 5000);
      }
    }
  }

  showError(message) {
    this.showStatus(message, "error");
  }

  editExpiration(code) {
    const expirations = window.operationsProcessor.getAvailableExpirations();
    const expiration = expirations[code];

    if (!expiration) {
      this.showStatus("Vencimiento no encontrado", "error");
      return;
    }

    // Llenar los campos con los datos actuales
    const nameInput = document.getElementById("newExpirationNameInput");
    const suffixesInput = document.getElementById("newExpirationSuffixesInput");

    nameInput.value = expiration.name;
    suffixesInput.value = expiration.suffixes
      ? expiration.suffixes.join(", ")
      : "";

    // Cambiar el botón a "Actualizar"
    const addBtn = document.getElementById("addExpirationBtn");
    addBtn.textContent = "Actualizar";
    addBtn.onclick = () => this.updateExpiration(code);

    // Scroll hacia los campos
    nameInput.scrollIntoView({ behavior: "smooth", block: "center" });
    nameInput.focus();

    this.showStatus(`Editando vencimiento ${code}`, "info");
  }

  async updateExpiration(oldCode) {
    const nameInput = document.getElementById("newExpirationNameInput");
    const suffixesInput = document.getElementById("newExpirationSuffixesInput");

    const name = nameInput.value.trim();
    const suffixes = suffixesInput.value
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s);

    // Validaciones (mismas que en addExpiration)
    if (!name) {
      this.showStatus("Ingresa el nombre del mes", "error");
      return;
    }

    if (suffixes.length === 0) {
      this.showStatus("Ingresa al menos un sufijo", "error");
      return;
    }

    if (suffixes.length > 3) {
      this.showStatus("Máximo 3 sufijos permitidos", "error");
      return;
    }

    const originalSuffixes = suffixesInput.value.trim();
    if (originalSuffixes.endsWith(",") || originalSuffixes.startsWith(",")) {
      this.showStatus("No pongas comas al inicio o final", "error");
      return;
    }

    if (originalSuffixes.includes(",,")) {
      this.showStatus("No pongas comas consecutivas", "error");
      return;
    }

    try {
      // Generar nuevo código
      const newCode = this.generateMonthCode(name);

      // Si el código cambió, eliminar el anterior y agregar el nuevo
      if (oldCode !== newCode) {
        await window.operationsProcessor.removeExpiration(oldCode);
        await window.operationsProcessor.addExpiration(newCode, name, suffixes);
      } else {
        // Si el código es el mismo, solo actualizar
        await window.operationsProcessor.updateExpiration(
          oldCode,
          name,
          suffixes
        );
      }

      // Limpiar campos y restaurar botón
      nameInput.value = "";
      suffixesInput.value = "";
      const addBtn = document.getElementById("addExpirationBtn");
      addBtn.textContent = "Agregar";
      addBtn.onclick = () => this.addExpiration();

      this.loadExpirationsToSelect();
      this.loadExpirationsList();
      this.showStatus(`Vencimiento ${newCode} actualizado`, "success");
    } catch (error) {
      console.error("Error actualizando vencimiento:", error);
      this.showStatus("Error actualizando vencimiento", "error");
    }
  }

  // ===== Instruments Sync UI (Phase 4 - US2) =====

  async setupInstrumentsSyncUI() {
    const manualRefreshBtn = document.getElementById("manualRefreshBtn");
    if (manualRefreshBtn) {
      manualRefreshBtn.addEventListener("click", () => this.triggerManualSync());
    }
    
    // Load initial sync status
    await this.updateSyncDisplay();
  }

  async updateSyncDisplay() {
    const lastSyncDisplay = document.getElementById("lastSyncDisplay");
    const syncStatus = document.getElementById("syncStatus");
    
    if (!lastSyncDisplay) return;

    try {
      // Try to read metadata from chrome.storage.local first
      const meta = await this.readInstrumentsMeta();
      
      if (meta && meta.fetchedAt) {
        const fetchedDate = new Date(meta.fetchedAt);
        const now = new Date();
        const diffMs = now - fetchedDate;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        let timeAgo;
        if (diffMins < 1) {
          timeAgo = "hace menos de 1 minuto";
        } else if (diffMins < 60) {
          timeAgo = `hace ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;
        } else if (diffHours < 24) {
          timeAgo = `hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
        } else {
          timeAgo = `hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
        }

        lastSyncDisplay.textContent = timeAgo;
        
        if (syncStatus) {
          const source = meta.source === 'broker-api' ? 'Broker API' : 'Archivo local';
          const count = meta.count || 0;
          syncStatus.textContent = `Fuente: ${source} • ${count} instrumentos`;
        }
      } else {
        lastSyncDisplay.textContent = "No sincronizado";
        if (syncStatus) {
          syncStatus.textContent = "Sincronizá para obtener la lista actualizada";
        }
      }
    } catch (error) {
      console.error("Error updating sync display:", error);
      lastSyncDisplay.textContent = "Error al cargar";
      if (syncStatus) {
        syncStatus.textContent = "";
      }
    }
  }

  async readInstrumentsMeta() {
    // Try chrome.storage.local first (preferred)
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise((resolve) => {
        chrome.storage.local.get(['instrumentsWithDetails.meta'], (result) => {
          if (result && result['instrumentsWithDetails.meta']) {
            resolve(result['instrumentsWithDetails.meta']);
          } else {
            // Fallback to localStorage
            resolve(this.readInstrumentsMetaFromLocalStorage());
          }
        });
      });
    } else {
      // Fallback to localStorage
      return this.readInstrumentsMetaFromLocalStorage();
    }
  }

  readInstrumentsMetaFromLocalStorage() {
    try {
      const metaStr = localStorage.getItem('instrumentsWithDetails.meta');
      if (metaStr) {
        return JSON.parse(metaStr);
      }
    } catch (e) {
      console.warn('Could not read instruments meta from localStorage:', e);
    }
    return null;
  }

  async triggerManualSync() {
    const manualRefreshBtn = document.getElementById("manualRefreshBtn");
    const lastSyncDisplay = document.getElementById("lastSyncDisplay");
    const syncStatus = document.getElementById("syncStatus");

    if (!manualRefreshBtn || !lastSyncDisplay) return;

    // Disable button and show loading state
    manualRefreshBtn.disabled = true;
    manualRefreshBtn.innerHTML = '<span style="font-size: 14px; margin-right: 4px;">⏳</span><span>Sincronizando...</span>';
    lastSyncDisplay.textContent = "Sincronizando...";
    if (syncStatus) {
      syncStatus.textContent = "Obteniendo instrumentos del broker...";
    }

    try {
      // Import the sync service dynamically
      const { default: instrumentsSyncService } = await import('./frontend/src/services/instrumentsSyncService.js');
      
      // Trigger sync
      const result = await instrumentsSyncService.syncNow();

      if (result.ok) {
        // Update display immediately
        await this.updateSyncDisplay();
        
        // Show success message briefly
        if (syncStatus) {
          const source = result.fallback ? 'archivo local' : 'Broker API';
          syncStatus.textContent = `✅ Sincronización exitosa desde ${source}`;
          syncStatus.style.color = '#059669';
          
          setTimeout(() => {
            syncStatus.style.color = '#9ca3af';
            this.updateSyncDisplay();
          }, 3000);
        }
      } else {
        throw new Error(result.reason || 'Error desconocido');
      }
    } catch (error) {
      console.error("Manual sync error:", error);
      lastSyncDisplay.textContent = "Error al sincronizar";
      if (syncStatus) {
        syncStatus.textContent = `❌ ${error.message || 'Error al conectar con el broker'}`;
        syncStatus.style.color = '#dc2626';
        
        setTimeout(() => {
          syncStatus.style.color = '#9ca3af';
          this.updateSyncDisplay();
        }, 5000);
      }
    } finally {
      // Re-enable button
      manualRefreshBtn.disabled = false;
      manualRefreshBtn.innerHTML = '<span style="font-size: 14px; margin-right: 4px;">🔄</span><span>Sincronizar</span>';
    }
  }
}

// Inicializar cuando se carga el popup
document.addEventListener("DOMContentLoaded", () => {
  window.popupManager = new PopupManager();
});
