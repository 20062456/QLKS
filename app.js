document.addEventListener('DOMContentLoaded', () => {

    const roomConfig = ['101', '201', '202', '203', '204', '205', '301', '302', '303'];
    const pricing = {
        ac: { hourly: { firstHour: 70000, nextHour: 20000 }, overnight: 220000, daily: 350000 },
        no_ac: { hourly: { firstHour: 60000, nextHour: 10000 }, overnight: 180000, daily: 280000 }
    };
    const services = {
        water: { name: 'Nước suối', price: 10000 },
        redbull: { name: 'Redbull', price: 20000 }
    };

    function loadData(key, defaultValue) {
        const savedData = localStorage.getItem(key);
        return savedData ? JSON.parse(savedData) : defaultValue;
    }
    function saveData(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    }
    function initializeRooms() {
        let rooms = loadData('hotelRoomsData', null);
        if (!rooms) {
            rooms = {};
            roomConfig.forEach(roomId => {
                rooms[roomId] = { status: 'available', checkInTime: null, stayType: null, isUsingAC: false, services: [] };
            });
        }
        return rooms;
    }

    let roomsData = initializeRooms();
    let billHistory = loadData('hotelBillHistory', []);
    let selectedRoomId = null;
    let revenueChart = null;

    const roomListContainer = document.getElementById('room-list');
    const roomTitle = document.getElementById('room-title');
    const roomStatus = document.getElementById('room-status');
    const acStatus = document.getElementById('ac-status');
    const checkinTimeEl = document.getElementById('checkin-time');
    const stayTypeEl = document.getElementById('stay-type');
    const serviceList = document.getElementById('service-list');
    const totalBill = document.getElementById('total-bill');
    const checkinBtn = document.getElementById('checkin-btn');
    const checkoutBtn = document.getElementById('checkout-btn');
    const addWaterBtn = document.getElementById('add-water-btn');
    const addRedbullBtn = document.getElementById('add-redbull-btn');
    const toggleAcBtn = document.getElementById('toggle-ac-btn'); // Nút mới
    const tabs = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');
    const statsDateInput = document.getElementById('stats-date');
    const statsMonthInput = document.getElementById('stats-month');
    const statsYearInput = document.getElementById('stats-year');
    const totalRevenueSpan = document.getElementById('total-revenue');
    const dailyCheckoutsSpan = document.getElementById('daily-checkouts');
    const overnightCheckoutsSpan = document.getElementById('overnight-checkouts');
    const exportBtn = document.getElementById('export-data-btn');
    const importBtn = document.getElementById('import-data-btn');
    const importFileInput = document.getElementById('import-file-input');
    const checkinModal = document.getElementById('checkin-modal');
    const modalRoomId = document.getElementById('modal-room-id');
    const acCheckbox = document.getElementById('ac-checkbox');
    const stayTypeSelect = document.getElementById('stay-type-select');
    const confirmCheckinBtn = document.getElementById('confirm-checkin-btn');
    const cancelCheckinBtn = document.getElementById('cancel-checkin-btn');

    function renderRooms() {
        roomListContainer.innerHTML = '';
        Object.keys(roomsData).forEach(roomId => {
            const room = roomsData[roomId];
            const roomDiv = document.createElement('div');
            roomDiv.className = `room ${room.status}`;
            if (roomId === selectedRoomId) roomDiv.classList.add('selected');
            roomDiv.dataset.roomId = roomId;
            const roomNameSpan = document.createElement('span');
            roomNameSpan.textContent = `Phòng ${roomId}`;
            roomDiv.appendChild(roomNameSpan);
            if (room.status === 'occupied' && room.isUsingAC) {
                const acIcon = document.createElement('span');
                acIcon.className = 'ac-icon';
                acIcon.textContent = '❄️';
                acIcon.title = 'Phòng đang dùng điều hòa';
                roomDiv.appendChild(acIcon);
            }
            roomListContainer.appendChild(roomDiv);
        });
    }

    function displayRoomDetails(roomId) {
        const oldSelected = document.querySelector('.room.selected');
        if (oldSelected) oldSelected.classList.remove('selected');
        selectedRoomId = roomId;
        const room = roomsData[roomId];
        const newSelected = document.querySelector(`.room[data-room-id="${roomId}"]`);
        if (newSelected) newSelected.classList.add('selected');
        roomTitle.textContent = `Chi tiết Phòng ${roomId}`;
        roomStatus.textContent = room.status === 'available' ? 'Trống' : 'Đang có khách';
        acStatus.textContent = room.status === 'occupied' ? (room.isUsingAC ? 'Có' : 'Không') : '-';
        checkinTimeEl.textContent = room.checkInTime ? new Date(room.checkInTime).toLocaleString('vi-VN') : '-';
        let stayTypeText = '-';
        if (room.stayType === 'hourly') stayTypeText = 'Theo Giờ';
        else if (room.stayType === 'overnight') stayTypeText = 'Qua Đêm';
        else if (room.stayType === 'daily') stayTypeText = 'Theo Ngày';
        stayTypeEl.textContent = stayTypeText;
        serviceList.innerHTML = '';
        if (room.services) {
            room.services.forEach(service => {
                const li = document.createElement('li');
                li.textContent = `${service.name} - ${service.price.toLocaleString('vi-VN')} VNĐ`;
                serviceList.appendChild(li);
            });
        }
        updateButtonsAndBill(room);
    }

    // *** HÀM ĐƯỢC NÂNG CẤP ***
    function updateButtonsAndBill(room) {
        const isOccupied = room.status === 'occupied';
        checkinBtn.disabled = isOccupied;
        checkoutBtn.disabled = !isOccupied;
        addWaterBtn.disabled = !isOccupied;
        addRedbullBtn.disabled = !isOccupied;
        toggleAcBtn.disabled = !isOccupied; // Cập nhật trạng thái nút mới

        if (isOccupied) {
            totalBill.textContent = calculateBill(room).total.toLocaleString('vi-VN');
            // Cập nhật text và style cho nút điều hòa
            toggleAcBtn.textContent = room.isUsingAC ? 'Tắt Điều hòa' : 'Bật Điều hòa';
            room.isUsingAC ? toggleAcBtn.classList.add('active') : toggleAcBtn.classList.remove('active');
        } else {
            totalBill.textContent = '0';
            toggleAcBtn.textContent = 'Bật Điều hòa';
            toggleAcBtn.classList.remove('active');
        }
    }

    function calculateBill(room) {
        if (!room.checkInTime) return { total: 0, roomCost: 0, serviceCost: 0, roomCostDetails: '', serviceCostDetails: '' };
        const priceTier = room.isUsingAC ? 'ac' : 'no_ac';
        const roomPriceConfig = pricing[priceTier];
        let roomCost = 0;
        let roomCostDetails = '';
        const checkIn = new Date(room.checkInTime);
        if (room.stayType === 'hourly') {
            const hoursStayed = Math.max(1, Math.ceil((new Date() - checkIn) / 3600000));
            if (hoursStayed <= 1) {
                roomCost = roomPriceConfig.hourly.firstHour;
                roomCostDetails = `Theo giờ (1 giờ đầu): ${roomCost.toLocaleString('vi-VN')} VNĐ`;
            } else {
                roomCost = roomPriceConfig.hourly.firstHour + (hoursStayed - 1) * roomPriceConfig.hourly.nextHour;
                roomCostDetails = `Theo giờ (${hoursStayed} tiếng = 1 giờ đầu + ${hoursStayed - 1} giờ sau): ${roomCost.toLocaleString('vi-VN')} VNĐ`;
            }
        } else if (room.stayType === 'overnight') {
            roomCost = roomPriceConfig.overnight;
            roomCostDetails = `Qua đêm: ${roomCost.toLocaleString('vi-VN')} VNĐ`;
        } else if (room.stayType === 'daily') {
            roomCost = roomPriceConfig.daily;
            roomCostDetails = `Theo ngày: ${roomCost.toLocaleString('vi-VN')} VNĐ`;
        }
        const serviceCost = (room.services || []).reduce((total, service) => total + service.price, 0);
        const serviceCounts = {};
        (room.services || []).forEach(service => {
            serviceCounts[service.name] = (serviceCounts[service.name] || 0) + 1;
        });
        let serviceCostDetails = '';
        Object.keys(serviceCounts).forEach(serviceName => {
            const count = serviceCounts[serviceName];
            const price = services[Object.keys(services).find(key => services[key].name === serviceName)].price;
            serviceCostDetails += `\n- ${serviceName} (x${count}): ${(price * count).toLocaleString('vi-VN')} VNĐ`;
        });
        if (serviceCostDetails === '') serviceCostDetails = '\n- Không có';
        const total = roomCost + serviceCost;
        return { roomCost, serviceCost, total, roomCostDetails, serviceCostDetails };
    }
    
    function handleCheckOut() {
        if (!selectedRoomId) return;
        const room = roomsData[selectedRoomId];
        const bill = calculateBill(room);
        const checkInTime = new Date(room.checkInTime);
        const checkOutTime = new Date();
        const billDetails = `
--- HÓA ĐƠN PHÒNG ${selectedRoomId} ---
**Thời gian:**
- Giờ vào: ${checkInTime.toLocaleString('vi-VN')}
- Giờ ra: ${checkOutTime.toLocaleString('vi-VN')}
**Tiền phòng:**
- ${bill.roomCostDetails}
**Tiền dịch vụ:**${bill.serviceCostDetails}
------------------------------------
**TỔNG CỘNG: ${bill.total.toLocaleString('vi-VN')} VNĐ**`;
        if (confirm(billDetails + "\n\nBạn có muốn thanh toán và trả phòng không?")) {
            billHistory.push({
                roomId: selectedRoomId,
                checkInTime: checkInTime.toISOString(),
                checkOutTime: checkOutTime.toISOString(),
                stayType: room.stayType,
                isUsingAC: room.isUsingAC, ...bill
            });
            saveData('hotelBillHistory', billHistory);
            room.status = 'available';
            room.checkInTime = null;
            room.stayType = null;
            room.isUsingAC = false;
            room.services = [];
            saveData('hotelRoomsData', roomsData);
            renderRooms();
            displayRoomDetails(selectedRoomId);
            updateStats();
        }
    }

    // *** HÀM MỚI ***
    function handleToggleAC() {
        if (!selectedRoomId || roomsData[selectedRoomId].status !== 'occupied') return;
        const room = roomsData[selectedRoomId];
        room.isUsingAC = !room.isUsingAC; // Đảo ngược trạng thái
        saveData('hotelRoomsData', roomsData); // Lưu lại
        displayRoomDetails(selectedRoomId); // Cập nhật chi tiết (bao gồm cả tiền)
        renderRooms(); // Cập nhật danh sách phòng (để hiện/ẩn icon)
    }

    function updateStats() {
        // ... (hàm này giữ nguyên)
        const activeTab = document.querySelector('.tab-link.active').dataset.tab;
        let filteredBills = [];
        let labels = [];
        let data = [];
        if (activeTab === 'daily') {
            const selectedDate = statsDateInput.value;
            if (!selectedDate) return;
            filteredBills = billHistory.filter(bill => bill.checkOutTime.startsWith(selectedDate));
            for(let i = -3; i <= 3; i++) {
                const date = new Date(selectedDate);
                date.setDate(date.getDate() + i);
                const dateKey = date.toISOString().split('T')[0];
                labels.push(dateKey.slice(5));
                const dayRevenue = billHistory.filter(b => b.checkOutTime.startsWith(dateKey)).reduce((sum, b) => sum + b.total, 0);
                data.push(dayRevenue);
            }
        } else if (activeTab === 'monthly') {
            const selectedMonth = statsMonthInput.value;
            if (!selectedMonth) return;
            filteredBills = billHistory.filter(bill => bill.checkOutTime.startsWith(selectedMonth));
            const year = selectedMonth.split('-')[0];
            for (let i = 1; i <= 12; i++) {
                const monthKey = `${year}-${String(i).padStart(2, '0')}`;
                labels.push(monthKey);
                const monthRevenue = billHistory.filter(b => b.checkOutTime.startsWith(monthKey)).reduce((sum, b) => sum + b.total, 0);
                data.push(monthRevenue);
            }
        } else if (activeTab === 'yearly') {
            const selectedYear = statsYearInput.value;
            if (!selectedYear) return;
            filteredBills = billHistory.filter(bill => bill.checkOutTime.startsWith(selectedYear));
            for (let i = 4; i >= 0; i--) {
                const year = parseInt(selectedYear) - i;
                labels.push(year);
                const yearRevenue = billHistory.filter(b => b.checkOutTime.startsWith(year.toString())).reduce((sum, b) => sum + b.total, 0);
                data.push(yearRevenue);
            }
        }
        const totalRevenue = filteredBills.reduce((sum, bill) => sum + bill.total, 0);
        const dailyCheckouts = filteredBills.filter(bill => bill.stayType === 'daily').length;
        const overnightCheckouts = filteredBills.filter(bill => bill.stayType === 'overnight').length;
        totalRevenueSpan.textContent = totalRevenue.toLocaleString('vi-VN');
        dailyCheckoutsSpan.textContent = dailyCheckouts;
        overnightCheckoutsSpan.textContent = overnightCheckouts;
        renderChart(labels, data);
    }

    function renderChart(labels, data) {
        // ... (hàm này giữ nguyên)
        const ctx = document.getElementById('revenueChart').getContext('2d');
        if (revenueChart) revenueChart.destroy();
        revenueChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Doanh thu (VNĐ)',
                    data: data,
                    backgroundColor: 'rgba(0, 123, 255, 0.5)',
                    borderColor: 'rgba(0, 123, 255, 1)',
                    borderWidth: 1
                }]
            },
            options: { scales: { y: { beginAtZero: true } }, responsive: true, maintainAspectRatio: false }
        });
    }

    // --- GÁN SỰ KIỆN ---

    tabs.forEach(tab => tab.addEventListener('click', () => { /* ... */ })); // (giữ nguyên)
    roomListContainer.addEventListener('click', e => { /* ... */ }); // (giữ nguyên)
    checkinBtn.addEventListener('click', () => { /* ... */ }); // (giữ nguyên)
    checkoutBtn.addEventListener('click', handleCheckOut);
    addWaterBtn.addEventListener('click', () => { /* ... */ }); // (giữ nguyên)
    addRedbullBtn.addEventListener('click', () => { /* ... */ }); // (giữ nguyên)
    [statsDateInput, statsMonthInput, statsYearInput].forEach(input => input.addEventListener('change', updateStats));
    exportBtn.addEventListener('click', () => { /* ... */ }); // (giữ nguyên)
    importBtn.addEventListener('click', () => importFileInput.click());
    importFileInput.addEventListener('change', (event) => { /* ... */ }); // (giữ nguyên)
    confirmCheckinBtn.addEventListener('click', () => { /* ... */ }); // (giữ nguyên)
    cancelCheckinBtn.addEventListener('click', () => checkinModal.style.display = 'none');
    
    // Gán sự kiện cho nút mới
    toggleAcBtn.addEventListener('click', handleToggleAC);
    
    // Copy lại các hàm và sự kiện đã rút gọn ở trên
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(item => item.classList.remove('active'));
            tab.classList.add('active');
            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(tab.dataset.tab).classList.add('active');
            updateStats();
        });
    });
    roomListContainer.addEventListener('click', e => {
        const roomDiv = e.target.closest('.room');
        if (roomDiv) displayRoomDetails(roomDiv.dataset.roomId);
    });
    checkinBtn.addEventListener('click', () => {
        if (!selectedRoomId || roomsData[selectedRoomId].status === 'occupied') return;
        modalRoomId.textContent = selectedRoomId;
        acCheckbox.checked = false;
        checkinModal.style.display = 'flex';
    });
    addWaterBtn.addEventListener('click', () => {
        if (!selectedRoomId) return;
        roomsData[selectedRoomId].services.push(services.water);
        saveData('hotelRoomsData', roomsData);
        displayRoomDetails(selectedRoomId);
    });
    addRedbullBtn.addEventListener('click', () => {
        if (!selectedRoomId) return;
        roomsData[selectedRoomId].services.push(services.redbull);
        saveData('hotelRoomsData', roomsData);
        displayRoomDetails(selectedRoomId);
    });
    exportBtn.addEventListener('click', () => {
        const allData = { roomsData: roomsData, billHistory: billHistory };
        const dataStr = JSON.stringify(allData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `hotel_data_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
        alert('Đã xuất dữ liệu ra tệp. Vui lòng lưu tệp này vào thư mục của bạn!');
    });
    importFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importedData = JSON.parse(e.target.result);
                if (importedData.roomsData && importedData.billHistory) {
                    if (confirm('Dữ liệu hiện tại sẽ bị ghi đè. Bạn có chắc chắn muốn phục hồi dữ liệu từ tệp không?')) {
                        saveData('hotelRoomsData', importedData.roomsData);
                        saveData('hotelBillHistory', importedData.billHistory);
                        alert('Phục hồi dữ liệu thành công! Trang sẽ được tải lại.');
                        location.reload();
                    }
                } else alert('Lỗi: Tệp dữ liệu không hợp lệ.');
            } catch (error) { alert('Lỗi khi đọc tệp: ' + error.message); }
        };
        reader.readAsText(file);
    });
    confirmCheckinBtn.addEventListener('click', () => {
        const room = roomsData[selectedRoomId];
        room.status = 'occupied';
        room.checkInTime = new Date().toISOString();
        room.stayType = stayTypeSelect.value;
        room.isUsingAC = acCheckbox.checked;
        saveData('hotelRoomsData', roomsData);
        checkinModal.style.display = 'none';
        renderRooms();
        displayRoomDetails(selectedRoomId);
    });
    
    function initialize() {
        const today = new Date();
        statsDateInput.value = today.toISOString().split('T')[0];
        statsMonthInput.value = today.toISOString().slice(0, 7);
        statsYearInput.value = today.getFullYear();
        renderRooms();
        updateStats();
    }
    initialize();
});