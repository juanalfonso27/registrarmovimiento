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

  init() {
    this.initMap()
    this.initEventListeners()
    this.loadAreas()
    this.updateStats()
    this.updateAreasList()
  this.updateAreaSelect()

    // Initialize drawn items layer
    this.drawnItems = new L.FeatureGroup()
    this.map.addLayer(this.drawnItems)

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
        remove: true,
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

    // Add satellite as default
    satelliteLayer.addTo(this.map)

    const baseMaps = {
      'Satelital': satelliteLayer,
      'Callejero': streetLayer,
    }

    L.control.layers(baseMaps, null, { position: 'topright' }).addTo(this.map)
  }

  initEventListeners() {
    // Product form submission (multiple products support)
    document.getElementById("product-form").addEventListener("submit", (e) => {
      e.preventDefault()
      this.submitProducts()
    })

    // Location button
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

    const areaData = {
      id: Date.now().toString(),
      name: name,
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
                <button onclick="app.selectAreaFromMap('${areaData.id}')" class="mt-2 bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700">
                    Seleccionar
                </button>
            </div>
        `)

    this.drawnItems.addLayer(layer)

    // Save and update UI
    this.saveData()
    this.updateStats()
    this.updateAreasList()
    this.updateAreaSelect()
  }

  onAreaDeleted(e) {
    e.layers.eachLayer((layer) => {
      if (layer.areaId) {
        this.areas = this.areas.filter((area) => area.id !== layer.areaId)
        this.products = this.products.filter((product) => product.areaId !== layer.areaId)
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
        date,
        notes,
        created: new Date().toISOString(),
      })
    }

    // Append and save
    this.products.push(...newProducts)
    this.saveData()

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
  }

  selectAreaFromMap(areaId) {
    document.getElementById("area-select").value = areaId
    this.selectArea(areaId)
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
                            <p class="text-sm text-gray-600">${area.area.toFixed(2)} hectáreas</p>
                            <p class="text-xs text-gray-500">${areaProducts.length} productos aplicados</p>
                        </div>
                        <div class="text-right">
                            <span class="inline-block w-3 h-3 bg-green-500 rounded-full"></span>
                        </div>
                    </div>
                    ${
                      areaProducts.length > 0
                        ? `
                        <div class="mt-3 space-y-2">
                            ${areaProducts
                              .map(
                                (product) => `
                                <div class="bg-gray-50 p-3 rounded">
                                    <div class="flex items-start justify-between">
                                        <div>
                                            <div class="text-sm font-medium text-gray-800">${product.name} <span class="text-xs text-gray-500">(${product.type})</span></div>
                                            <div class="text-xs text-gray-600">${product.quantity} ${product.unit} • ${new Date(product.date).toLocaleDateString()}</div>
                                        </div>
                                        <div class="text-xs text-gray-500 text-right">${product.created ? new Date(product.created).toLocaleString() : ''}</div>
                                    </div>
                                    ${product.notes ? `<div class="mt-2 text-xs text-gray-700">Notas: ${product.notes}</div>` : ''}
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
      option.textContent = `${area.name} (${area.area.toFixed(2)} ha)`
      select.appendChild(option)
    })
  }

  saveData() {
    localStorage.setItem("agro-areas", JSON.stringify(this.areas))
    localStorage.setItem("agro-products", JSON.stringify(this.products))
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
