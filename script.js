// Agricultural GPS App - JavaScript
const L = window.L // Declare the L variable

class AgroGPSApp {
  constructor() {
    this.map = null
    this.drawnItems = null
    this.areas = JSON.parse(localStorage.getItem("agro-areas") || "[]")
    this.products = JSON.parse(localStorage.getItem("agro-products") || "[]")
    this.selectedArea = null
    this.userLocationMarker = null

    this.init()
  }

  async init() {
    this.initMap()
    this.initEventListeners()
    // Try to sync from Firestore (if available). This will replace local data if remote data exists.
    try {
      await this.syncFromFirestore()
    } catch (err) {
      console.warn('No se pudo sincronizar con Firestore en init:', err && err.message)
    }
    // Initialize drawn items layer BEFORE loading areas so loadAreas can add layers into it
    this.drawnItems = new L.FeatureGroup()
    this.map.addLayer(this.drawnItems)

    this.loadAreas()
    this.updateStats()
    this.updateAreasList()
    this.updateAreaSelect()

    // Initialize draw control
    const drawControl = new L.Control.Draw({
      position: "topright",
      draw: {
        polygon: {
          allowIntersection: false,
          drawError: {
            color: "#e1e100",
            message: "<strong>Error:</strong> Las líneas no pueden cruzarse!",
          },
          shapeOptions: {
            color: "#16a34a",
            weight: 3,
            fillOpacity: 0.2,
          },
        },
        rectangle: {
          shapeOptions: {
            color: "#16a34a",
            weight: 3,
            fillOpacity: 0.2,
          },
        },
        circle: false,
        circlemarker: false,
        marker: false,
        polyline: false,
      },
      edit: {
        featureGroup: this.drawnItems,
        remove: false, // Deshabilita la opción de eliminar todos los elementos
      },
    })

    this.map.addControl(drawControl)

    // Event listeners for drawing
    this.map.on(L.Draw.Event.CREATED, (e) => this.onAreaCreated(e))
    this.map.on(L.Draw.Event.DELETED, (e) => this.onAreaDeleted(e))
    this.map.on(L.Draw.Event.EDITED, (e) => this.onAreaEdited(e))
  }

  initMap() {
    // Initialize map centered on a reasonable default
    this.map = L.map('map').setView([-24.964116, -55.2566249], 15)

    const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    })

    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Esri',
      maxZoom: 19,
    })

    // para ver como sateliteeeee
    satelliteLayer.addTo(this.map)

    const baseMaps = {
      'Satelital': satelliteLayer,
      'Callejero': streetLayer,
    }

    L.control.layers(baseMaps, null, { position: 'topright' }).addTo(this.map)
  }

  initEventListeners() {
    
    document.getElementById("product-form").addEventListener("submit", (e) => {
      e.preventDefault()
      this.submitProducts()
    })

    // boton de ubicacion actual
    document.getElementById("locate-btn").addEventListener("click", () => {
      this.getUserLocation()
    })

    // Area selection
    document.getElementById("area-select").addEventListener("change", (e) => {
      this.selectArea(e.target.value)
    })

    // Add/remove product lines
    document.getElementById("add-product-line").addEventListener("click", () => {
      this.addProductLine()
    })

    // Fullscreen toggle for map
    const fsBtn = document.getElementById('fullscreen-btn')
    if (fsBtn) {
      fsBtn.addEventListener('click', () => this.toggleFullscreen())
    }

    // Fullscreen toggle for areas panel
    const areasFsBtn = document.getElementById('areas-fullscreen-btn')
    if (areasFsBtn) {
      areasFsBtn.addEventListener('click', () => this.toggleAreasFullscreen())
    }

    // Export to PDF button
    const exportPdfBtn = document.getElementById('export-pdf-btn')
    if (exportPdfBtn) {
      exportPdfBtn.addEventListener('click', () => this.exportAreasToPdf())
    }

    // Areas search/filter
    const areasSearch = document.getElementById('areas-search')
    if (areasSearch) {
      areasSearch.addEventListener('input', (e) => {
        const q = e.target.value.trim().toLowerCase()
        this.updateAreasList(q)
      })
    }

    // Delegate remove button clicks from container
    document.getElementById("products-container").addEventListener("click", (e) => {
      if (e.target && e.target.classList.contains("remove-product-line")) {
        const line = e.target.closest('.product-line')
        if (line) line.remove()
      }
    })

    // If Firebase initializes after the app, listen for it and sync
    window.addEventListener('firebase-ready', async () => {
      try {
        await this.syncFromFirestore()
        this.updateStats()
        this.updateAreasList()
        this.updateAreaSelect()
        this.loadAreas()
      } catch (err) {
        console.warn('Error syncing after firebase-ready:', err && err.message)
      }
    })
  }

  toggleFullscreen() {
    const mapContainer = document.getElementById('map')
    if (!mapContainer) return

    const doc = window.document
    const isFull = !!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement)

    const request = () => {
      if (mapContainer.requestFullscreen) return mapContainer.requestFullscreen()
      if (mapContainer.webkitRequestFullscreen) return mapContainer.webkitRequestFullscreen()
      if (mapContainer.mozRequestFullScreen) return mapContainer.mozRequestFullScreen()
      if (mapContainer.msRequestFullscreen) return mapContainer.msRequestFullscreen()
    }

    const exit = () => {
      if (doc.exitFullscreen) return doc.exitFullscreen()
      if (doc.webkitExitFullscreen) return doc.webkitExitFullscreen()
      if (doc.mozCancelFullScreen) return doc.mozCancelFullScreen()
      if (doc.msExitFullscreen) return doc.msExitFullscreen()
    }

    if (!isFull) {
      request().then(() => this.map.invalidateSize())
    } else {
      exit().then(() => this.map.invalidateSize())
    }
  }

  // Ensure Leaflet resizes when fullscreen changes by other means (Esc)
  onFullscreenChange() {
    if (this.map) {
      setTimeout(() => this.map.invalidateSize(), 250)
    }
  }

  // Toggle fullscreen for the areas panel
  toggleAreasFullscreen() {
    const panel = document.getElementById('areas-panel')
    if (!panel) return

    const doc = window.document
    const isFull = !!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement)

    const request = () => {
      if (panel.requestFullscreen) return panel.requestFullscreen()
      if (panel.webkitRequestFullscreen) return panel.webkitRequestFullscreen()
      if (panel.mozRequestFullScreen) return panel.mozRequestFullScreen()
      if (panel.msRequestFullscreen) return panel.msRequestFullscreen()
    }

    const exit = () => {
      if (doc.exitFullscreen) return doc.exitFullscreen()
      if (doc.webkitExitFullscreen) return doc.webkitExitFullscreen()
      if (doc.mozCancelFullScreen) return doc.mozCancelFullScreen()
      if (doc.msExitFullscreen) return doc.msExitFullscreen()
    }

    if (!isFull) {
      request()
    } else {
      exit()
    }
  }

  onAreaCreated(e) {
    const layer = e.layer
    const area = this.calculateArea(layer)

    // Prompt for area name
    const name = prompt("Nombre del área:", `Campo ${this.areas.length + 1}`)
    if (!name) return
    // Prompt for owner/propietario (obligatorio)
    let owner = ''
    while (true) {
      owner = prompt('Propietario del área (obligatorio):', '')
      if (owner === null) return // user cancelled
      owner = owner.trim()
      if (owner) break
      alert('Por favor ingresa el nombre del propietario')
    }

    const areaData = {
      id: Date.now().toString(),
      name: name,
      owner: owner,
      area: area,
      coordinates: layer.toGeoJSON().geometry.coordinates,
      type: layer instanceof L.Polygon ? "polygon" : "rectangle",
      created: new Date().toISOString(),
    }

    // Add to areas array
    this.areas.push(areaData)

    // Add to map with popup
    layer.areaId = areaData.id
    layer.bindPopup(`
            <div class="text-center">
                <h4 class="font-bold text-green-700">${name}</h4>
        <p class="text-sm text-gray-600">${area.toFixed(2)} hectáreas</p>
        <p class="text-xs text-gray-500">Propietario: ${owner || '—'}</p>
                <button onclick="app.selectAreaFromMap('${areaData.id}')" class="mt-2 bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700">
                    Seleccionar
                </button>
            </div>
        `)

    this.drawnItems.addLayer(layer)

    // Save and update UI
    this.saveData()
  // Save just this area to Firestore
  this.saveAreaToFirestore(areaData).catch((e) => console.warn(e))
    this.updateStats()
    this.updateAreasList()
    this.updateAreaSelect()

    // Auto-select the newly created area
    document.getElementById('area-select').value = areaData.id
    this.selectArea(areaData.id)
  }

  onAreaDeleted(e) {
    if (!confirm('¿Está seguro de que desea eliminar los datos de esta área? Esta acción es irreversible.')) {
      // If user cancels, stop the deletion process
      return;
    }
    e.layers.eachLayer((layer) => {
      if (layer.areaId) {
        const removed = this.areas.find((area) => area.id === layer.areaId)
        this.areas = this.areas.filter((area) => area.id !== layer.areaId)
        // Delete related products and remote entries
        const relatedProducts = this.products.filter((product) => product.areaId === layer.areaId)
        this.products = this.products.filter((product) => product.areaId !== layer.areaId)
        if (removed && removed.owner) this.deleteAreaFromFirestore(removed.id, removed.owner).catch((e) => console.warn(e))
        for (const rp of relatedProducts) {
          // delete each product remote
          this.deleteProductFromFirestore(rp.id, removed ? removed.owner : '').catch((e) => console.warn(e))
        }
      }
    })

    this.saveData()
    this.updateStats()
    this.updateAreasList()
    this.updateAreaSelect()
  }

  onAreaEdited(e) {
    e.layers.eachLayer((layer) => {
      if (layer.areaId) {
        const area = this.areas.find((a) => a.id === layer.areaId)
        if (area) {
          area.area = this.calculateArea(layer)
          area.coordinates = layer.toGeoJSON().geometry.coordinates

          // Update popup
          layer.setPopupContent(`
                        <div class="text-center">
                            <h4 class="font-bold text-green-700">${area.name}</h4>
                            <p class="text-sm text-gray-600">${area.area.toFixed(2)} hectáreas</p>
                            <p class="text-xs text-gray-500">Propietario: ${area.owner || '—'}</p>
                            <button onclick="app.selectAreaFromMap('${area.id}')" class="mt-2 bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700">
                                Seleccionar
                            </button>
                        </div>
                    `)
        }
      }
    })

    this.saveData()
    this.updateStats()
    this.updateAreasList()
    // Area sizes or names may have changed; update select and keep selection
    const currentSelection = document.getElementById('area-select').value
    this.updateAreaSelect()
    if (currentSelection) document.getElementById('area-select').value = currentSelection
    // Save updated areas (only those edited) to Firestore: find edited layers from event
    try {
      e.layers.eachLayer((layer) => {
        if (layer.areaId) {
          const a = this.areas.find((ar) => ar.id === layer.areaId)
          if (a) this.saveAreaToFirestore(a).catch((err) => console.warn(err))
        }
      })
    } catch (err) {
      // ignore
    }
  }

  calculateArea(layer) {
    // Calculate area in hectares using Leaflet's built-in method
    let area = 0

    if (layer instanceof L.Polygon || layer instanceof L.Rectangle) {
      const latlngs = layer.getLatLngs()[0]
      area = L.GeometryUtil.geodesicArea(latlngs)
    }

    // Convert from square meters to hectares
    return area / 10000
  }

  loadAreas() {
    // Clear any existing drawn layers so reload is idempotent
    if (this.drawnItems) this.drawnItems.clearLayers()

    this.areas.forEach((areaData) => {
      let layer

      if (areaData.type === "polygon") {
        layer = L.polygon(areaData.coordinates[0].map((coord) => [coord[1], coord[0]]))
      } else {
        // Rectangle - convert coordinates to bounds
        const coords = areaData.coordinates[0]
        const lats = coords.map((c) => c[1])
        const lngs = coords.map((c) => c[0])
        const bounds = [
          [Math.min(...lats), Math.min(...lngs)],
          [Math.max(...lats), Math.max(...lngs)],
        ]
        layer = L.rectangle(bounds)
      }

      layer.areaId = areaData.id
      layer.setStyle({
        color: "#16a34a",
        weight: 3,
        fillOpacity: 0.2,
      })

      layer.bindPopup(`
                <div class="text-center">
                    <h4 class="font-bold text-green-700">${areaData.name}</h4>
          <p class="text-sm text-gray-600">${areaData.area.toFixed(2)} hectáreas</p>
          <p class="text-xs text-gray-500">Propietario: ${areaData.owner || '—'}</p>
                    <button onclick="app.selectAreaFromMap('${areaData.id}')" class="mt-2 bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700">
                        Seleccionar
                    </button>
                </div>
            `)

      this.drawnItems.addLayer(layer)
    })
  }

  addProduct() {
    // Legacy single-product method removed. Use submitProducts instead.
  }

  // Add a new product input line to the form
  addProductLine() {
  const container = document.getElementById('products-container')
  if (!container) return

  const line = document.createElement('div')
  line.className = 'product-line border rounded p-3 space-y-3'

  line.innerHTML = `
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Tipo de Producto</label>
      <select class="product-type w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent">
        <option value="Fungicida">Fungicida</option>
        <option value="Herbicida">Herbicida</option>
        <option value="Insecticida">Insecticida</option>
        <option value="Foliare">Foliare</option>
        <option value="Fertilizante">Fertilizante</option>
      </select>
    </div>
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Nombre del Producto</label>
      <input type="text" class="product-name w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent" placeholder="Ej: Urea 46%">
    </div>
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Tipo de Trabajo</label>
      <input type="text" class="product-work-type w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent" placeholder="Ej: Siembra, Fumigación, Cosecha">
    </div>
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Dosis / Cantidad</label>
      <input type="number" class="product-quantity w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent" step="0.01" placeholder="0.00">
    </div>
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Unidad</label>
      <select class="product-unit w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent">
      <option value="litros">litros</option> 
      <option value="kilos">kilos</option>
        
        <option value="g">gramos</option>
        <option value="ml">ml</option>
      </select>
    </div>
    <div class="flex justify-end">
      <button type="button" class="remove-product-line bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg" title="Eliminar">Eliminar</button>
    </div>
  `

  container.appendChild(line)
  }

  // Handle submission of multiple product lines
  submitProducts() {
    const areaId = document.getElementById('area-select').value
    const date = document.getElementById('product-date').value
    const notes = document.getElementById('product-notes').value

    if (!areaId) {
      alert('Por favor selecciona un área antes de registrar productos')
      return
    }

    if (!date) {
      alert('Por favor selecciona la fecha de aplicación')
      return
    }

    const lines = Array.from(document.querySelectorAll('.product-line'))
    const newProducts = []

    for (const line of lines) {
      const type = line.querySelector('.product-type')?.value || ''
      const name = line.querySelector('.product-name')?.value.trim() || ''
      const quantityRaw = line.querySelector('.product-quantity')?.value
      const quantity = quantityRaw === '' ? NaN : Number.parseFloat(quantityRaw)
      const unit = line.querySelector('.product-unit')?.value || ''
      const workType = line.querySelector('.product-work-type')?.value.trim() || ''

      if (!name || !quantity || Number.isNaN(quantity)) {
        alert('Por favor completa nombre y dosis/cantidad válidos en cada línea de producto')
        return
      }

      newProducts.push({
        id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
        areaId,
        type,
        name,
        quantity,
        unit,
        workType,
        date,
        notes,
        created: new Date().toISOString(),
      })
    }

    // Append and save
    this.products.push(...newProducts)
    this.saveData()

    // Save each new product to Firestore individually
    for (const np of newProducts) {
      this.saveProductToFirestore(np).catch((e) => console.warn(e))
    }

    // Reset form lines to single empty line
    const container = document.getElementById('products-container')
    container.innerHTML = ''
    // Recreate one empty product line
    this.addProductLine()

    // Reset other fields
    document.getElementById('product-notes').value = ''
    document.getElementById('product-date').value = new Date().toISOString().split('T')[0]

    // Update UI
    this.updateAreasList()

    alert('Producto(s) registrado(s) exitosamente')
  }

  selectArea(areaId) {
    this.selectedArea = areaId

    // Highlight selected area on map
    this.drawnItems.eachLayer((layer) => {
      if (layer.areaId === areaId) {
        layer.setStyle({
          color: "#dc2626",
          weight: 4,
          fillOpacity: 0.3,
        })
        this.map.fitBounds(layer.getBounds())
      } else {
        layer.setStyle({
          color: "#16a34a",
          weight: 3,
          fillOpacity: 0.2,
        })
      }
    })

    // Update areas list highlighting
    document.querySelectorAll(".area-item").forEach((item) => {
      item.classList.remove("selected")
      if (item.dataset.areaId === areaId) {
        item.classList.add("selected")
      }
    })

    // Update selected area hectares display
    const label = document.getElementById('selected-area-hectares')
    const areaObj = this.areas.find((a) => a.id === areaId)
    if (label) {
      if (areaObj) {
        label.textContent = `Área: ${areaObj.area.toFixed(2)} ha`
      } else {
        label.textContent = 'Área: — ha'
      }
    }
    const ownerLabel = document.getElementById('selected-area-owner')
    if (ownerLabel) {
      ownerLabel.textContent = areaObj ? `Propietario: ${areaObj.owner || '—'}` : 'Propietario: —'
    }
  }

  selectAreaFromMap(areaId) {
    document.getElementById("area-select").value = areaId
    this.selectArea(areaId)
  }

  deleteAreaById(areaId) {
    if (!confirm('¿Está seguro de que desea eliminar esta área y todos sus productos? Esta acción es irreversible.')) {
      return
    }

    const layerToDelete = this.drawnItems.getLayers().find(layer => layer.areaId === areaId)

    if (layerToDelete) {
      // Simulate a delete event for this single layer
      const event = { layers: new L.FeatureGroup([layerToDelete]) }
      this.onAreaDeleted(event)
      this.drawnItems.removeLayer(layerToDelete) // Also remove from map visually
    } else {
      console.warn(`Layer with areaId ${areaId} not found on map.`)
    }
  }

  getUserLocation() {
    const button = document.getElementById('locate-btn')

    if (!navigator.geolocation) {
      alert('La geolocalización no está soportada en este navegador')
      return
    }

    // Show loading state
    button.innerHTML = '<div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full loading-spinner"></div>'
    button.disabled = true

    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('geolocation success', position)

        let lat = Number(position.coords.latitude)
        let lng = Number(position.coords.longitude)
        const accuracy = Number(position.coords.accuracy || 0)

        // Detect possible swapped coordinates (lat should be between -90 and 90)
        if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) {
          console.warn('Detected latitude out of range; swapping lat/lng')
          const tmp = lat
          lat = lng
          lng = tmp
        }

        if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
          alert('Coordenadas inválidas recibidas: ' + JSON.stringify({ lat, lng }))
          button.disabled = false
          button.innerHTML = this._getLocateIcon()
          return
        }

        if (accuracy && accuracy > 1000) {
          const proceed = confirm(`La precisión de la ubicación es baja (~${Math.round(accuracy)} m).\n¿Deseas centrar igualmente el mapa?`)
          if (!proceed) {
            button.disabled = false
            button.innerHTML = this._getLocateIcon()
            return
          }
        }

        if (this.map) this.map.flyTo([lat, lng], 16)

        if (this.userLocationMarker) this.map.removeLayer(this.userLocationMarker)

        this.userLocationMarker = L.circleMarker([lat, lng], {
          color: '#3b82f6',
          fillColor: '#3b82f6',
          fillOpacity: 0.8,
          radius: 8,
          className: 'pulse-marker',
        }).addTo(this.map)

        this.userLocationMarker
          .bindPopup(`
            <div class="text-center">
              <h4 class="font-bold text-blue-700">Tu Ubicación</h4>
              <p class="text-xs text-gray-600">Lat: ${lat.toFixed(6)}</p>
              <p class="text-xs text-gray-600">Lng: ${lng.toFixed(6)}</p>
              <p class="text-xs text-gray-500">Precisión: ${accuracy ? Math.round(accuracy) + ' m' : 'desconocida'}</p>
            </div>
          `)
          .openPopup()

        button.disabled = false
        button.innerHTML = this._getLocateIcon()
      },
      (error) => {
        let message = 'Error al obtener la ubicación'
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'Permisos de ubicación denegados'
            break
          case error.POSITION_UNAVAILABLE:
            message = 'Ubicación no disponible'
            break
          case error.TIMEOUT:
            message = 'Tiempo de espera agotado'
            break
        }
        alert(message)
        button.disabled = false
        button.innerHTML = this._getLocateIcon()
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      },
    )
  }

  // Small helper to return the locate button SVG (keeps code DRY)
  _getLocateIcon() {
    return `
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
      </svg>
    `
  }

  updateStats() {
    const totalAreas = this.areas.length
    const totalHectares = this.areas.reduce((sum, area) => sum + area.area, 0)

    document.getElementById("total-areas").textContent = totalAreas
    document.getElementById("total-hectares").textContent = totalHectares.toFixed(2)
  }

  updateAreasList(filter = '') {
    const container = document.getElementById("areas-list")

    if (this.areas.length === 0) {
      container.innerHTML = '<div class="p-4 text-center text-gray-500">No hay áreas registradas</div>'
      return
    }

    const q = (filter || '').toLowerCase()

    // Filter areas by name or by any product matching the query
    const filtered = this.areas.filter((area) => {
      if (!q) return true
      if (area.name && area.name.toLowerCase().includes(q)) return true
      const areaProducts = this.products.filter((p) => p.areaId === area.id)
      if (areaProducts.some((p) => (p.name || '').toLowerCase().includes(q) || (p.type || '').toLowerCase().includes(q))) return true
      return false
    })

    if (filtered.length === 0) {
      container.innerHTML = `<div class="p-4 text-center text-gray-500">No se encontraron áreas que coincidan con "${filter}"</div>`
      return
    }

    container.innerHTML = filtered
      .map((area) => {
        const areaProducts = this.products.filter((p) => p.areaId === area.id)

        return `
                <div class="area-item p-4 border-b border-gray-200 cursor-pointer" data-area-id="${area.id}" onclick="app.selectArea('${area.id}')">
                    <div class="flex justify-between items-start">
                        <div>
                            <h4 class="font-semibold text-gray-800">${area.name}</h4>
                            <p class="text-sm text-gray-600">${area.area.toFixed(2)} hectáreas • <span class="text-xs text-gray-500">Propietario: ${area.owner || '—'}</span></p>
                            <p class="text-xs text-gray-500">${areaProducts.length} productos aplicados</p>
                        </div>
                        <div class="text-right flex items-center space-x-2 relative"> <!-- Added relative positioning for dropdown -->
                            <button class="p-1 rounded-full hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300" onclick="event.stopPropagation(); app.toggleAreaMenu('${area.id}')">
                                <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
                            </button>
                            <div id="area-menu-${area.id}" class="hidden absolute right-0 mt-2 w-40 bg-white rounded-md shadow-lg z-10">
                                <button onclick="event.stopPropagation(); app.editAreaDetails('${area.id}'); app.toggleAreaMenu('${area.id}')" class="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Editar</button>
                                <button onclick="event.stopPropagation(); app.deleteAreaById('${area.id}'); app.toggleAreaMenu('${area.id}')" class="block w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-100">Eliminar</button>
                            </div>
                        </div>
                    </div>
                    ${
                      areaProducts.length > 0
                        ? `
                        <div class="mt-3 space-y-2">
                            ${areaProducts
                              .map(
                                (product) => `
                                <div class="bg-gray-50 p-3 rounded product-display" id="product-display-${product.id}">
                                    <div class="flex items-start justify-between">
                                        <div>
                                            <div class="text-sm font-medium text-gray-800">${product.name} <span class="text-xs text-gray-500">(${product.type})</span></div>
                                            <div class="text-xs text-gray-600">${product.quantity} ${product.unit} • ${new Date(product.date).toLocaleDateString()}</div>
                                            ${product.workType ? `<div class="mt-1 text-xs text-gray-600">Tipo de Trabajo: ${product.workType}</div>` : ''}
                                        </div>
                                        <div class="text-xs text-gray-500 text-right flex space-x-2 items-center relative"> <!-- Added relative positioning for dropdown -->
                                            <span>${product.created ? new Date(product.created).toLocaleString() : ''}</span>
                                            <button class="p-1 rounded-full hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300" onclick="event.stopPropagation(); app.toggleProductMenu('${product.id}')">
                                                <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
                                            </button>
                                            <div id="product-menu-${product.id}" class="hidden absolute right-0 mt-2 w-40 bg-white rounded-md shadow-lg z-10">
                                                <button onclick="event.stopPropagation(); app.toggleProductEditForm('${product.id}', true); app.toggleProductMenu('${product.id}')" class="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Editar</button>
                                                <button onclick="event.stopPropagation(); app.deleteProductById('${product.id}'); app.toggleProductMenu('${product.id}')" class="block w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-100">Eliminar</button>
                                            </div>
                                        </div>
                                    </div>
                                    ${product.notes ? `<div class="mt-2 text-xs text-gray-700">Notas: ${product.notes}</div>` : ''}
                                </div>
                                <div class="hidden product-edit-form" id="product-edit-form-${product.id}">
                                  ${this._renderProductEditForm(product)}
                                </div>
                            `,
                              )
                              .join("")}
                        </div>
                    `
                        : ""
                    }
                </div>
            `
      })
      .join("")
  }

  updateAreaSelect() {
    const select = document.getElementById("area-select")
    select.innerHTML = '<option value="">Selecciona un área</option>'

    this.areas.forEach((area) => {
      const option = document.createElement("option")
      option.value = area.id
      option.textContent = `${area.name} (${area.area.toFixed(2)} ha) ${area.owner ? '- ' + area.owner : ''}`
      select.appendChild(option)
    })
  }

  saveData() {
    localStorage.setItem("agro-areas", JSON.stringify(this.areas))
    localStorage.setItem("agro-products", JSON.stringify(this.products))
  }

  // Per-document Firestore operations (efficient — write only what changed)
  async saveAreaToFirestore(area) {
    if (!window.firebaseDB) return
    const db = window.firebaseDB
    const mod = await import('https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js')
    const { doc, setDoc } = mod
    try {
      const ownerPath = encodeURIComponent(area.owner)
  // Ensure owner doc exists (so collection('propietario') will list it)
  const ownerRef = doc(db, `propietario/${ownerPath}`)
      await setDoc(ownerRef, { owner: area.owner, updated: new Date().toISOString() }, { merge: true })

  const ref = doc(db, `propietario/${ownerPath}/areas/${area.id}`)
      const payload = Object.assign({}, area, { coordinates: JSON.stringify(area.coordinates) })
      await setDoc(ref, payload)
    } catch (err) {
      console.warn('saveAreaToFirestore error:', err && err.message)
    }
  }

  async deleteAreaFromFirestore(areaId, owner) {
    if (!window.firebaseDB || !owner) return
    const db = window.firebaseDB
    const mod = await import('https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js')
    const { doc, deleteDoc } = mod
    try {
      const ownerPath = encodeURIComponent(owner)
  await deleteDoc(doc(db, `propietario/${ownerPath}/areas/${areaId}`))
    } catch (err) {
      console.warn('deleteAreaFromFirestore error:', err && err.message)
    }
  }

  async saveProductToFirestore(product) {
    if (!window.firebaseDB) return
    // Determine owner from product.areaId
    const area = this.areas.find((a) => a.id === product.areaId)
    if (!area || !area.owner) return
    const ownerPath = encodeURIComponent(area.owner)
    const db = window.firebaseDB
    const mod = await import('https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js')
    const { doc, setDoc } = mod
    try {
      // Ensure owner doc exists
  const ownerRef = doc(db, `propietario/${ownerPath}`)
      await setDoc(ownerRef, { owner: area.owner, updated: new Date().toISOString() }, { merge: true })

  const ref = doc(db, `propietario/${ownerPath}/products/${product.id}`)
      await setDoc(ref, product)
    } catch (err) {
      console.warn('saveProductToFirestore error:', err && err.message)
    }
  }

  async deleteProductFromFirestore(productId, owner) {
    if (!window.firebaseDB || !owner) return
    const db = window.firebaseDB
    const mod = await import('https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js')
    const { doc, deleteDoc } = mod
    try {
      const ownerPath = encodeURIComponent(owner)
  await deleteDoc(doc(db, `propietario/${ownerPath}/products/${productId}`))
    } catch (err) {
      console.warn('deleteProductFromFirestore error:', err && err.message)
    }
  }

  // Save current areas/products to Firestore. Uses dynamic imports so script.js stays non-module.
  async saveToFirestore() {
    if (!window.firebaseDB) return
    const db = window.firebaseDB
    const mod = await import('https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js')
    const { doc, setDoc, collection, getDocs, deleteDoc } = mod
  // Group areas and products by owner and write under propietario/{owner}/areas and propietario/{owner}/products
    const owners = {}
    for (const a of this.areas) {
      owners[a.owner] = owners[a.owner] || { areas: [], products: [] }
      owners[a.owner].areas.push(a)
    }
    for (const p of this.products) {
      owners[p.areaId ? (this.areas.find((a) => a.id === p.areaId) || {}).owner : ''] = owners[p.areaId ? (this.areas.find((a) => a.id === p.areaId) || {}).owner : ''] || { areas: [], products: [] }
      const ownerForProd = (this.areas.find((a) => a.id === p.areaId) || {}).owner || ''
      if (ownerForProd) owners[ownerForProd].products.push(p)
    }

    for (const ownerName of Object.keys(owners)) {
      if (!ownerName) continue
      const ownerAreas = owners[ownerName].areas
      const ownerProducts = owners[ownerName].products

  const basePath = `propietario/${encodeURIComponent(ownerName)}`

      // Areas
      for (const a of ownerAreas) {
        const ref = doc(db, `${basePath}/areas/${a.id}`)
        const payload = Object.assign({}, a, { coordinates: JSON.stringify(a.coordinates) })
        await setDoc(ref, payload)
      }

      // Cleanup remote areas for this owner
      try {
        const remoteAreasSnap = await getDocs(collection(db, `${basePath}/areas`))
        for (const d of remoteAreasSnap.docs) {
          if (!ownerAreas.find((a) => a.id === d.id)) {
            await deleteDoc(doc(db, `${basePath}/areas/${d.id}`))
          }
        }
      } catch (err) {
        // ignore
      }

      // Products
      for (const p of ownerProducts) {
        const ref = doc(db, `${basePath}/products/${p.id}`)
        await setDoc(ref, p)
      }

      // Cleanup remote products for this owner
      try {
        const remoteProdSnap = await getDocs(collection(db, `${basePath}/products`))
        for (const d of remoteProdSnap.docs) {
          if (!ownerProducts.find((p) => p.id === d.id)) {
            await deleteDoc(doc(db, `${basePath}/products/${d.id}`))
          }
        }
      } catch (err) {
        // ignore
      }
    }
  }

  // Load data from Firestore if any exists; otherwise keep localStorage data
  async syncFromFirestore() {
    if (!window.firebaseDB) return
    const db = window.firebaseDB
    const mod = await import('https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js')
    const { collection, getDocs } = mod
    // Read owners collection and merge all owners' areas/products into local arrays
    const allAreas = []
    const allProducts = []

    const propietariosCol = collection(db, 'propietario')
    const propietariosSnap = await getDocs(propietariosCol)

    for (const ownerDoc of propietariosSnap.docs) {
      const ownerId = ownerDoc.id
      // areas
      try {
  const areasSnap = await getDocs(collection(db, `propietario/${ownerId}/areas`))
        for (const d of areasSnap.docs) {
          const data = d.data()
          if (data && typeof data.coordinates === 'string') {
            try { data.coordinates = JSON.parse(data.coordinates) } catch (err) {}
          }
          allAreas.push(data)
        }
      } catch (err) {
        // ignore per-owner errors
      }

      // products
      try {
  const prodsSnap = await getDocs(collection(db, `propietario/${ownerId}/products`))
        for (const d of prodsSnap.docs) {
          allProducts.push(d.data())
        }
      } catch (err) {
        // ignore
      }
    }

    if (allAreas.length > 0 || allProducts.length > 0) {
      this.areas = allAreas
      this.products = allProducts
      localStorage.setItem('agro-areas', JSON.stringify(this.areas))
      localStorage.setItem('agro-products', JSON.stringify(this.products))
    }
  }

  // Export areas and their products to a PDF document
  async exportAreasToPdf() {
    const { jsPDF } = window.jspdf
    const doc = new jsPDF()

    const ownerInput = prompt("Ingresa el nombre del propietario para el reporte (dejar en blanco para todos):")
    const filterByOwner = ownerInput ? ownerInput.trim() : null

    let filteredAreas = this.areas
    let filteredProducts = this.products

    if (filterByOwner) {
      filteredAreas = this.areas.filter(area => area.owner.toLowerCase() === filterByOwner.toLowerCase())
      const areaIds = filteredAreas.map(area => area.id)
      filteredProducts = this.products.filter(product => areaIds.includes(product.areaId))

      if (filteredAreas.length === 0) {
        alert(`No se encontraron áreas para el propietario "${filterByOwner}".`) 
        return
      }
    }

    doc.setFontSize(18)
    doc.text(`Reporte de Áreas Registradas${filterByOwner ? ` para ${filterByOwner}` : ''}`, 14, 22)

    let y = 30

    if (filteredAreas.length === 0) {
      doc.setFontSize(12)
      doc.text('No hay áreas registradas.', 14, y)
    } else {
      // Sort areas by owner and then by name
      const sortedAreas = [...filteredAreas].sort((a, b) => {
        if (a.owner < b.owner) return -1
        if (a.owner > b.owner) return 1
        if (a.name < b.name) return -1
        if (a.name > b.name) return 1
        return 0
      })

      let currentOwner = ''

      for (const area of sortedAreas) {
        if (area.owner !== currentOwner) {
          currentOwner = area.owner
          y += 10
          doc.setFontSize(14)
          doc.text(`Propietario: ${currentOwner}`, 14, y)
          y += 7
        }

        doc.setFontSize(12)
        doc.text(`Área: ${area.name} (${area.area.toFixed(2)} ha)`, 20, y)
        y += 7

        const areaProducts = filteredProducts.filter((p) => p.areaId === area.id)

        if (areaProducts.length > 0) {
          doc.setFontSize(10)
          y += 3
          doc.text('Productos Aplicados:', 25, y)
          y += 5

          const headers = ['Tipo', 'Nombre', 'Cantidad', 'Unidad', 'Fecha', 'Notas', 'Tipo de Trabajo']
          const data = areaProducts.map((p) => [
            p.type,
            p.name,
            p.quantity,
            p.unit,
            new Date(p.date).toLocaleDateString(),
            p.notes || '-',
            p.workType || '-',
          ])

          doc.autoTable({ // This requires jspdf-autotable plugin, which is often bundled or added separately
            startY: y,
            head: [headers],
            body: data,
            margin: { left: 25, right: 14 },
            styles: { fontSize: 8, cellPadding: 1, overflow: 'linebreak' },
            headStyles: { fillColor: [4, 120, 87], textColor: [255, 255, 255] },
            columnStyles: { 
              0: { cellWidth: 20 }, // Tipo
              1: { cellWidth: 40 }, // Nombre
              2: { cellWidth: 20 }, // Cantidad
              3: { cellWidth: 15 }, // Unidad
              4: { cellWidth: 20 }, // Fecha
              5: { cellWidth: 'auto' }, // Notas
              6: { cellWidth: 30 }, // Tipo de Trabajo
            },
            didDrawPage: function(data) {
              // Footer
              let str = 'Página ' + doc.internal.getNumberOfPages()
              doc.setFontSize(10)
              doc.text(str, doc.internal.pageSize.width - 14, doc.internal.pageSize.height - 10)
            }
          })
          y = doc.autoTable.previous.finalY + 5
        } else {
          doc.setFontSize(10)
          doc.text('No hay productos registrados para esta área.', 25, y + 3)
          y += 10
        }
        y += 5 // Spacing between areas

        // Check if new page is needed
        if (y > doc.internal.pageSize.height - 30 && area !== sortedAreas[sortedAreas.length -1]) {
          doc.addPage()
          y = 22 // Reset Y for new page
          doc.setFontSize(14)
          doc.text(`Reporte de Áreas Registradas (continuación)${filterByOwner ? ` para ${filterByOwner}` : ''}`, 14, 22)
          y = 30
        }
      }
    }

    doc.save(`reporte_areas_agrogps${filterByOwner ? `_${filterByOwner}` : ''}.pdf`)
  }

  async editAreaDetails(areaId) {
    const areaToEdit = this.areas.find(area => area.id === areaId)
    if (!areaToEdit) {
      console.warn(`Area with ID ${areaId} not found.`)
      return
    }

    const newName = prompt("Editar nombre del área:", areaToEdit.name)
    if (newName === null) return // User cancelled

    let newOwner = newName.trim() ? prompt('Editar propietario del área (obligatorio):', areaToEdit.owner) : null
    if (newOwner === null) return // User cancelled
    newOwner = newOwner.trim()

    if (!newName.trim() || !newOwner) {
      alert('El nombre del área y el propietario son obligatorios.')
      return
    }

    // Update the area object
    areaToEdit.name = newName.trim()
    areaToEdit.owner = newOwner

    // Update the corresponding Leaflet layer's popup
    const layerToUpdate = this.drawnItems.getLayers().find(layer => layer.areaId === areaId)
    if (layerToUpdate) {
      layerToUpdate.bindPopup(`
                    <div class="text-center">
                        <h4 class="font-bold text-green-700">${areaToEdit.name}</h4>
                        <p class="text-sm text-gray-600">${areaToEdit.area.toFixed(2)} hectáreas</p>
                        <p class="text-xs text-gray-500">Propietario: ${areaToEdit.owner || '—'}</p>
                        <button onclick="app.selectAreaFromMap('${areaToEdit.id}')" class="mt-2 bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700">
                            Seleccionar
                        </button>
                    </div>
                `)._updateContent()
    }

    // Save data and update UI
    this.saveData()
    await this.saveAreaToFirestore(areaToEdit).catch((e) => console.warn(e + ' (from editAreaDetails)'))
    this.updateStats()
    this.updateAreasList()
    this.updateAreaSelect()
    // Keep the current area selected in the dropdown
    document.getElementById('area-select').value = areaToEdit.id
    this.selectArea(areaToEdit.id)
  }

  // New method to toggle the visibility of the area action menu
  toggleAreaMenu(areaId) {
    const menu = document.getElementById(`area-menu-${areaId}`)
    if (menu) {
      menu.classList.toggle('hidden')
    }
  }

  // New method to toggle the visibility of the product action menu
  toggleProductMenu(productId) {
    const menu = document.getElementById(`product-menu-${productId}`)
    if (menu) {
      menu.classList.toggle('hidden')
    }
  }

  // New method to delete a product by its ID
  async deleteProductById(productId) {
    if (!confirm('¿Está seguro de que desea eliminar este producto? Esta acción es irreversible.')) {
      return
    }

    const productToDelete = this.products.find(p => p.id === productId)
    if (!productToDelete) {
      console.warn(`Product with ID ${productId} not found for deletion.`)
      return
    }

    this.products = this.products.filter(p => p.id !== productId)
    this.saveData()
    await this.deleteProductFromFirestore(productId, productToDelete.owner).catch((e) => console.warn(e + ' (from deleteProductById)'))
    this.updateAreasList()
  }

  // Method to render product edit form (new private helper)
  _renderProductEditForm(product) {
        const productTypes = ["Fungicida", "Herbicida", "Insecticida", "Foliare", "Fertilizante"]
        const productUnits = ["litros", "kilos", "g", "ml"]

        return `
            <div class="bg-blue-50 p-3 rounded space-y-2">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Tipo de Producto</label>
                    <select id="edit-product-type-${product.id}" class="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                        ${productTypes.map(type => `<option value="${type}" ${product.type === type ? 'selected' : ''}>${type}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Nombre del Producto</label>
                    <input type="text" id="edit-product-name-${product.id}" class="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" value="${product.name}" placeholder="Ej: Urea 46%">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Dosis / Cantidad</label>
                    <input type="number" id="edit-product-quantity-${product.id}" class="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" step="0.01" value="${product.quantity}" placeholder="0.00">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Unidad</label>
                    <select id="edit-product-unit-${product.id}" class="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                        ${productUnits.map(unit => `<option value="${unit}" ${product.unit === unit ? 'selected' : ''}>${unit}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Tipo de Trabajo</label>
                    <input type="text" id="edit-product-work-type-${product.id}" class="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" value="${product.workType || ''}" placeholder="Ej: Siembra, Fumigación, Cosecha">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                    <textarea id="edit-product-notes-${product.id}" rows="2" class="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Observaciones adicionales...">${product.notes || ''}</textarea>
                </div>
                <div class="flex justify-end space-x-2">
                    <button type="button" onclick="event.stopPropagation(); app.saveProductDetails('${product.id}')" class="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg">Guardar</button>
                    <button type="button" onclick="event.stopPropagation(); app.toggleProductEditForm('${product.id}', false)" class="bg-gray-400 hover:bg-gray-500 text-white px-3 py-1 rounded-lg">Cancelar</button>
                </div>
            </div>
        `
    }

  // Toggle visibility of product display and edit form
  toggleProductEditForm(productId, showForm) {
    const productDisplay = document.getElementById(`product-display-${productId}`)
    const productEditForm = document.getElementById(`product-edit-form-${productId}`)
    if (productDisplay && productEditForm) {
      productDisplay.classList.toggle('hidden', showForm)
      productEditForm.classList.toggle('hidden', !showForm)
    }
  }

  async saveProductDetails(productId) {
    const productToEdit = this.products.find(product => product.id === productId)
    if (!productToEdit) {
      console.warn(`Product with ID ${productId} not found for saving.`)
      return
    }

    // Get values from the form
    const newType = document.getElementById(`edit-product-type-${productId}`).value
    const newName = document.getElementById(`edit-product-name-${productId}`).value.trim()
    const newQuantityRaw = document.getElementById(`edit-product-quantity-${productId}`).value
    const newQuantity = Number.parseFloat(newQuantityRaw)
    const newUnit = document.getElementById(`edit-product-unit-${productId}`).value
    const newWorkType = document.getElementById(`edit-product-work-type-${productId}`).value.trim()
    const newNotes = document.getElementById(`edit-product-notes-${productId}`).value.trim()

    // Basic validation
    if (!newName || Number.isNaN(newQuantity) || newQuantity <= 0) {
      alert('Por favor completa nombre y dosis/cantidad válidos en cada línea de producto')
      return
    }

    // Update the product object
    productToEdit.type = newType
    productToEdit.name = newName
    productToEdit.quantity = newQuantity
    productToEdit.unit = newUnit
    productToEdit.workType = newWorkType
    productToEdit.notes = newNotes
    productToEdit.updated = new Date().toISOString()

    // Save data and update UI
    this.saveData()
    await this.saveProductToFirestore(productToEdit).catch((e) => console.warn(e + ' (from saveProductDetails)'))
    this.updateAreasList()
    // After saving, hide the form and show the display again
    this.toggleProductEditForm(productId, false)
  }
}

// Add Leaflet GeometryUtil for area calculations
L.GeometryUtil = L.extend(L.GeometryUtil || {}, {
  geodesicArea: (latLngs) => {
    var pointsCount = latLngs.length,
      area = 0.0,
      d2r = Math.PI / 180,
      p1,
      p2

    if (pointsCount > 2) {
      for (var i = 0; i < pointsCount; i++) {
        p1 = latLngs[i]
        p2 = latLngs[(i + 1) % pointsCount]
        area += (p2.lng - p1.lng) * d2r * (2 + Math.sin(p1.lat * d2r) + Math.sin(p2.lat * d2r))
      }
      area = (area * 6378137.0 * 6378137.0) / 2.0
    }

    return Math.abs(area)
  },
})

// Initialize app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.app = new AgroGPSApp()
})
