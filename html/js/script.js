class Calendar {
    constructor() {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
        this.socket = new WebSocket(wsProtocol + window.location.host + '/ws');
        this.initSocket();

        this.calendarDays = document.getElementById('calendar-days');
        this.monthYearHeader = document.getElementById('month-year');
        this.selectedElement = null;
        this.a = [];
        this.date = new Date();
        this.selectedGroup = "";

        this.shedule = null;
    }

    initSocket() {
        this.socket.onmessage = (event) => {
            this.handleServerMessage(event.data);
        };
        this.socket.onopen = () => {
            this.socket.send("_get_schedule");
        };
    }

    handleServerMessage(data) {
        this.shedule = JSON.parse(data);
        if (this.selectedElement && this.a.length > 0) {
            this.changeSelected(this.selectedElement);
        }
    }

    generate() {
        const year = this.date.getFullYear();
        const month = this.date.getMonth();

        const now = new Date();
        const isCurrentMonthAndYear = now.getFullYear() === year && now.getMonth() === month;
        const today = now.getDate();

        const monthNames = [
            "ЯНВАРЬ", "ФЕВРАЛЬ", "МАРТ", "АПРЕЛЬ", "МАЙ", "ИЮНЬ",
            "ИЮЛЬ", "АВГУСТ", "СЕНТЯБРЬ", "ОКТЯБРЬ", "НОЯБРЬ", "ДЕКАБРЬ"
        ];

        this.monthYearHeader.textContent = `${monthNames[month]} ${year}`;
        this.calendarDays.innerHTML = '';
        this.a = [];

        const firstDayOfMonth = new Date(year, month, 1);
        let startDayOfWeek = firstDayOfMonth.getDay();
        startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

        const createWeekRow = () => {
            const week = document.createElement("div");
            week.className = 'calendar-week';

            const btn = document.createElement("div");
            btn.className = 'week-select-btn';
            btn.textContent = '>>';
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.changeSelected(week);
            });

            week.appendChild(btn);
            return week;
        };

        let weekDiv = createWeekRow();
        const totalDays = new Date(year, month + 1, 0).getDate();

        for (let i = startDayOfWeek; i > 0; i--) {
            const emptyDiv = document.createElement('div');
            emptyDiv.classList.add('day', 'empty');

            let prevDate = new Date(year, month, 1 - i);
            emptyDiv.textContent = prevDate.getDate().toString();

            emptyDiv.addEventListener("click", () => {
                this.date = prevDate;
                this.generate();
            });

            this.a.push(emptyDiv);
            weekDiv.appendChild(emptyDiv);
        }

        for (let day = 1; day <= totalDays; day++) {
            const dayDiv = document.createElement('div');
            dayDiv.classList.add('day');
            dayDiv.textContent = day;

            const currentDayObject = new Date(year, month, day);
            let dayOfWeek = currentDayObject.getDay();
            dayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

            dayDiv.dataset.dayOfWeek = dayOfWeek;

            if (isCurrentMonthAndYear && day === today) {
                this.selectedElement = dayDiv;
                dayDiv.classList.add('selected');
            }

            this.a.push(dayDiv);

            dayDiv.addEventListener('click', () => {
                this.changeSelected(dayDiv);
            });

            weekDiv.appendChild(dayDiv);

            if (weekDiv.childElementCount >= 8) {
                this.calendarDays.appendChild(weekDiv);
                weekDiv = createWeekRow();
            }
        }

        let nextMonthDay = 1;

        if (weekDiv.childElementCount > 1) {
            while (weekDiv.childElementCount < 8) {
                const emptyDiv = document.createElement('div');
                emptyDiv.classList.add('day', 'empty');

                const dayValue = nextMonthDay;
                emptyDiv.textContent = dayValue.toString();

                emptyDiv.addEventListener("click", () => {
                    this.date = new Date(year, month + 1, dayValue);
                    this.generate();
                });

                this.a.push(emptyDiv);
                weekDiv.appendChild(emptyDiv);
                nextMonthDay++;
            }
            this.calendarDays.appendChild(weekDiv);
        }

        if (this.shedule && this.selectedElement) {
            if (this.selectedElement.classList.contains("day")) {
                this.pullShedule(this.selectedElement);
            } else if (this.selectedElement.classList.contains("calendar-week")) {
                this.pullWeekShedule();
            }
        }
    }


    changeSelected(div) {
        if (div.classList.contains("calendar-week")) {
            this.pullWeekShedule();
        } else if (div.classList.contains("day")) {
            if (div.classList.contains("empty")) return;
            this.pullShedule(div);
        }

        if (this.selectedElement) {
            this.selectedElement.classList.remove('selected');
        }

        div.classList.add('selected');
        this.selectedElement = div;
    }

    pullShedule(dayDiv) {
        const titleHandler = document.getElementsByClassName("schedule-title")[0];
        const contentHandler = document.getElementsByClassName("schedule-content")[0];

        if (!titleHandler || !contentHandler) return;

        titleHandler.innerHTML = '';
        contentHandler.innerHTML = '';

        if (!this.shedule) {
            contentHandler.textContent = "Данные еще загружаются...";
            return;
        }

        const weekDay = parseInt(dayDiv.dataset.dayOfWeek, 10);
        const groupData = this.shedule.groups[this.selectedGroup];
        const dayData = groupData && groupData.days ? groupData.days[weekDay] : null;

        if (!dayData) {
            titleHandler.textContent = "Нет данных на этот день";
            return;
        }

        titleHandler.textContent = dayData.name.toUpperCase();

        if (dayData.lessons && dayData.lessons.length > 0) {
            const container = document.createElement("div");
            container.classList.add("weekly-day-card");
            dayData.lessons.forEach(lesson => {
                container.appendChild(this.formatLesson(lesson));
            });
            contentHandler.appendChild(container);
        } else {
            contentHandler.textContent = "ЗАНЯТИЙ НЕТ";
        }
    }

    formatLesson(lesson) {
        const lessonDiv = document.createElement('div');
        lessonDiv.className = 'lesson-item';
        lessonDiv.style.marginBottom = '15px';

        let lessonName = this.checkLesson(lesson.name);
        let isMasked = true;

        if (lessonName === undefined) {
            lessonName = (lesson.name === null || lesson.name === undefined) ? "Название не указано" : lesson.name;
            isMasked = false;
        }

        const injectLinksIntoText = (text, links) => {
            if (!text || text === "Название не указано") return text;
            if (!links || links.length === 0) return text;

            const chars = Array.from(text);

            const sortedLinks = [...links].sort((a, b) => b.start - a.start);

            sortedLinks.forEach(link => {
                if (!link || !link.uri) return;

                const start = link.start;
                const end = link.end;

                if (start >= 0 && end <= chars.length && start < end) {
                    const anchorText = chars.slice(start, end).join('');

                    const htmlLink = `<a href="${link.uri}" target="_blank" rel="noopener noreferrer" style="color: #0066cc; text-decoration: underline;">${anchorText}</a>`

                    chars.splice(start, end - start, htmlLink);
                }
            });

            return chars.join('');
        };

        lessonDiv.innerHTML = `
        <div class="lesson-header" style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <div style="font-size: 11px; color: #777; margin-bottom: 4px;">[ ВРЕМЯ: ${lesson.time || '—'} ]</div>
            <span style="display: flex; gap: 8px;">
                <div class="drop-trigger" style="color: dimgray; text-decoration: underline; cursor: pointer; display: ${isMasked ? 'inline-block' : 'none'};">сбросить</div>
                <div class="edit-trigger" style="color: blue; text-decoration: underline; cursor: pointer;">изменить</div>  
            </span>
        </div>
        <div class="lesson-name" style="font-style: italic; line-height: 1.3;"></div>
       
        <div class="edit-form" style="display: none; margin-top: 10px; flex-direction: column; gap: 8px;">
            <textarea class="edit-input" style="width: 100%; box-sizing: border-box;"></textarea>
            <div style="display: flex; gap: 8px;">
                <button class="save-btn" style="cursor: pointer;">Сохранить</button>
                <button class="cancel-btn" style="cursor: pointer;">Отмена</button>
            </div>
        </div>
    `;

        const lessonNameDiv = lessonDiv.querySelector('.lesson-name');

        lessonNameDiv.innerHTML = injectLinksIntoText(lessonName, lesson.links);

        const editTrigger = lessonDiv.querySelector('.edit-trigger');
        const dropTrigger = lessonDiv.querySelector('.drop-trigger');
        const editForm = lessonDiv.querySelector('.edit-form');
        const editInput = lessonDiv.querySelector('.edit-input');
        const saveBtn = lessonDiv.querySelector('.save-btn');
        const cancelBtn = lessonDiv.querySelector('.cancel-btn');

        const refreshCurrentView = () => {
            if (!this.selectedElement) return;
            if (this.selectedElement.classList.contains("day")) {
                this.pullShedule(this.selectedElement);
            } else if (this.selectedElement.classList.contains("calendar-week")) {
                this.pullWeekShedule();
            }
        };

        editTrigger.addEventListener('click', () => {
            editForm.style.display = 'flex';
            editTrigger.style.display = 'none';
            editInput.value = lessonNameDiv.textContent === "Название не указано" ? "" : lessonNameDiv.textContent;
        });

        cancelBtn.addEventListener('click', () => {
            editForm.style.display = 'none';
            editTrigger.style.display = 'block';
        });

        dropTrigger.addEventListener('click', () => {
            this.dropLesson(lesson.name);
            refreshCurrentView();
        });

        saveBtn.addEventListener('click', () => {
            const rawData = lesson.name;
            const newData = editInput.value.trim();

            this.maskLesson(rawData, newData);

            lessonNameDiv.innerHTML = injectLinksIntoText(newData || 'Название не указано', lesson.links);
            editForm.style.display = 'none';
            editTrigger.style.display = 'block';

            refreshCurrentView();
        });

        return lessonDiv;
    }



    _getMasks() {
        const masksData = localStorage.getItem('schedule_masks');
        return masksData ? JSON.parse(masksData) : {};
    }

    maskLesson(rawData, newData) {
        const masksMap = this._getMasks();
        masksMap[rawData] = newData;
        localStorage.setItem('schedule_masks', JSON.stringify(masksMap));
    }

    checkLesson(lessonName) {
        const masksMap = this._getMasks();
        return masksMap[lessonName];
    }

    dropLesson(lessonName) {
        const masksMap = this._getMasks();
        delete masksMap[lessonName];
        localStorage.setItem('schedule_masks', JSON.stringify(masksMap));
    }

    pullWeekShedule() {
        const titleHandler = document.getElementsByClassName("schedule-title")[0];
        const contentHandler = document.getElementsByClassName("schedule-content")[0];

        if (!titleHandler || !contentHandler) return;

        titleHandler.textContent = "РАСПИСАНИЕ НА ВСЮ НЕДЕЛЮ";
        contentHandler.innerHTML = '';

        if (!this.shedule) {
            contentHandler.textContent = "Данные еще загружаются...";
            return;
        }

        const groupData = this.shedule.groups[this.selectedGroup];
        const daysData = groupData ? groupData.days : [];

        if (!daysData || daysData.length === 0) {
            contentHandler.textContent = "Расписание отсутствует";
            return;
        }

        const gridContainer = document.createElement('div');
        gridContainer.className = 'weekly-schedule-grid';

        daysData.forEach(dayData => {
            const dayCard = document.createElement('div');
            dayCard.className = 'weekly-day-card';

            const dayTitle = document.createElement('div');
            dayTitle.className = 'weekly-day-title';
            dayTitle.textContent = dayData.name.toUpperCase();
            dayCard.appendChild(dayTitle);

            const lessonsContainer = document.createElement('div');
            lessonsContainer.className = 'weekly-lessons-list';

            if (dayData.lessons && dayData.lessons.length > 0) {
                dayData.lessons.forEach(lesson => {
                    lessonsContainer.appendChild(this.formatLesson(lesson));
                });
            } else {
                const emptyItem = document.createElement('div');
                emptyItem.className = 'weekly-empty-lessons';
                emptyItem.textContent = 'Занятий нет';
                lessonsContainer.appendChild(emptyItem);
            }

            dayCard.appendChild(lessonsContainer);
            gridContainer.appendChild(dayCard);
        });

        contentHandler.appendChild(gridContainer);
    }

    initCustomDropdown() {
        const input = document.getElementById('group-input');
        const dropdown = document.getElementById('custom-drop-down');

        if (!input || !dropdown) return;

        const filterGroups = () => {
            const val = input.value.trim().toUpperCase();
            dropdown.innerHTML = '';

            if (!this.shedule || !this.shedule.groups) {
                dropdown.style.display = 'none';
                return;
            }

            const allGroups = Object.keys(this.shedule.groups);
            const filtered = allGroups.filter(group => group.toUpperCase().includes(val));

            if (filtered.length === 0) {
                dropdown.style.display = 'none';
                return;
            }

            filtered.forEach(groupName => {
                const item = document.createElement('div');
                item.className = 'dropdown-item';
                item.textContent = groupName;

                item.addEventListener('click', () => {
                    input.value = groupName;
                    this.selectedGroup = groupName;
                    localStorage.setItem("group", groupName)
                    dropdown.style.display = 'none';
                    this.generate();
                });

                dropdown.appendChild(item);
            });

            dropdown.style.display = 'block';
        };

        input.addEventListener('input', filterGroups);
        input.addEventListener('focus', filterGroups);

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.autocomplete-wrapper')) {
                dropdown.style.display = 'none';
            }
        });
    }
}
document.addEventListener('DOMContentLoaded', function () {
    let calendar = new Calendar();
    let input = document.getElementById("group-input")
    let groupName = localStorage.getItem("group")
    calendar.selectedGroup = groupName
    input.value = groupName

    calendar.generate();
    calendar.initCustomDropdown();

    let prevButton = document.getElementById("prev");
    let postButton = document.getElementById("post");

    if (prevButton) {
        prevButton.addEventListener("click", () => {
            let year = calendar.date.getFullYear();
            let month = calendar.date.getMonth();
            calendar.date = new Date(year, month - 1, 1);
            calendar.generate();
        });
    }

    if (postButton) {
        postButton.addEventListener("click", () => {
            let year = calendar.date.getFullYear();
            let month = calendar.date.getMonth();
            calendar.date = new Date(year, month + 1, 1);
            calendar.generate();
        });
    }

    const scheduleHandler = document.getElementById('schedule-handler');
    const closeBtn = document.getElementById('close-schedule');
    const calendarDaysContainer = document.getElementById('calendar-days');

    if (calendarDaysContainer && scheduleHandler) {
        calendarDaysContainer.addEventListener('click', (e) => {
            const isDay = e.target.classList.contains('day') && !e.target.classList.contains('empty');
            const isWeekBtn = e.target.classList.contains('week-select-btn');

            if (isDay || isWeekBtn) {
                if (window.innerWidth <= 850) {
                    scheduleHandler.classList.add('active');
                    document.body.style.overflow = 'hidden';
                }
            }
        });
    }

    if (closeBtn && scheduleHandler) {
        closeBtn.addEventListener('click', () => {
            scheduleHandler.classList.remove('active');
            document.body.style.overflow = '';
        });
    }
});
