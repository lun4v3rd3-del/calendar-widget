const WeekDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

class Calendar {
    constructor() {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
        this.socket = new WebSocket(wsProtocol + window.location.host + '/ws');

        this.calendarDays = document.getElementById('calendar-days');
        this.monthYearHeader = document.getElementById('month-year');
        this.titleHandler = document.querySelector(".schedule-title");
        this.contentHandler = document.querySelector(".schedule-content");

        this.date = new Date();
        this.selectedElement = null;
        this.allDayDivs = [];
        this.selectedGroup = localStorage.getItem("group") || "";
        this.schedule = null;

        this._initSocket();
    }

    _initSocket() {
        this.socket.onmessage = (e) => {
            this.schedule = JSON.parse(e.data);
            if (this.selectedElement && this.allDayDivs.length > 0) {
                this.changeSelected(this.selectedElement);
            }

            this.generate();
            this.initCustomDropdown();

        };
        this.socket.onopen = () => this.socket.send("_get_schedule");
    }

    _getMasks() {
        return JSON.parse(localStorage.getItem('schedule_masks')) || {};
    }

    maskLesson(raw, next) {
        const m = this._getMasks();
        m[raw] = next;
        localStorage.setItem('schedule_masks', JSON.stringify(m));
        this._refreshCurrentSchedule();
    }

    checkLesson(name) {
        return this._getMasks()[name];
    }

    dropLesson(name) {
        const m = this._getMasks();
        delete m[name];
        localStorage.setItem('schedule_masks', JSON.stringify(m));
        this._refreshCurrentSchedule();
    }

    _refreshCurrentSchedule() {
        if (!this.selectedElement) return;
        this.selectedElement.classList.contains("day")
            ? this.pullSchedule(this.selectedElement)
            : this.pullWeekSchedule();
    }

    generate() {
        if (!this.calendarDays || !this.monthYearHeader) return;
        this.initActualLesson();

        const year = this.date.getFullYear(), month = this.date.getMonth();
        const now = new Date(), today = now.getDate();
        const isCurrent = now.getFullYear() === year && now.getMonth() === month;

        const monthNames = ["ЯНВАРЬ", "ФЕВРАЛЬ", "МАРТ", "АПРЕЛЬ", "МАЙ", "ИЮНЬ", "ИЮЛЬ", "АВГУСТ", "СЕНТЯБРЬ", "ОКТЯБРЬ", "НОЯБРЬ", "ДЕКАБРЬ"];
        this.monthYearHeader.textContent = `${monthNames[month]} ${year}`;
        this.calendarDays.innerHTML = '';
        this.allDayDivs = [];

        const firstDay = new Date(year, month, 1);
        let startWeekDay = (firstDay.getDay() + 6) % 7;

        const createRow = () => {
            const row = document.createElement("div");
            row.className = 'calendar-week';
            const btn = document.createElement("div");
            btn.className = 'week-select-btn';
            btn.textContent = '>>';
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.changeSelected(row);
            });
            row.appendChild(btn);
            return row;
        };

        let currentWeekRow = createRow();
        const totalDays = new Date(year, month + 1, 0).getDate();

        for (let i = startWeekDay; i > 0; i--) {
            const prevDate = new Date(year, month, 1 - i);
            currentWeekRow.appendChild(this._createDayDiv(prevDate.getDate(), prevDate, true));
        }

        for (let day = 1; day <= totalDays; day++) {
            const cDate = new Date(year, month, day);
            const dayDiv = this._createDayDiv(day, cDate, false, (cDate.getDay() + 6) % 7);

            if (isCurrent && day === today) {
                this.selectedElement = dayDiv;
                dayDiv.classList.add('selected');
            }

            currentWeekRow.appendChild(dayDiv);

            if (currentWeekRow.childElementCount >= 8) {
                this.calendarDays.appendChild(currentWeekRow);
                currentWeekRow = createRow();
            }
        }

        let nextMonthDay = 1;
        if (currentWeekRow.childElementCount > 1) {
            while (currentWeekRow.childElementCount < 8) {
                const nDate = new Date(year, month + 1, nextMonthDay);
                currentWeekRow.appendChild(this._createDayDiv(nextMonthDay++, nDate, true));
            }
            this.calendarDays.appendChild(currentWeekRow);
        }

        if (this.schedule && this.selectedElement) {
            this.selectedElement.classList.contains("day") ? this.pullSchedule(this.selectedElement) : this.pullWeekSchedule();
        }
    }

    _createDayDiv(text, targetDate, isEmpty, dayOfWeek = null) {
        const div = document.createElement('div');
        div.className = `day ${isEmpty ? 'empty' : ''}`;
        div.textContent = text;
        if (dayOfWeek !== null) {
            div.dataset.dayOfWeek = dayOfWeek;
            div.dataset.fullDate = targetDate.toISOString();
        }

        div.addEventListener("click", () => {
            if (isEmpty) {
                this.date = targetDate;
                this.generate();
            } else {
                this.changeSelected(div);
            }
        });
        this.allDayDivs.push(div);
        return div;
    }

    changeSelected(div) {
        this.initActualLesson();

        if (div.classList.contains("empty")) return;
        if (this.selectedElement) this.selectedElement.classList.remove('selected');

        div.classList.add('selected');
        this.selectedElement = div;

        div.classList.contains("calendar-week") ? this.pullWeekSchedule() : this.pullSchedule(div);
    }

    pullSchedule(dayDiv) {
        if (!this._isValidHandlers()) return;
        this._clearHandlers();

        if (!this.schedule) return this.contentHandler.textContent = "Данные еще загружаются...";
        if (!this.selectedGroup) return this.titleHandler.textContent = "Выберите группу";

        const weekDay = parseInt(dayDiv.dataset.dayOfWeek, 10);
        const groupData = this.schedule.groups[this.selectedGroup];
        const dayData = groupData?.days?.find(d => d.id === weekDay);

        if (!dayData) return this.titleHandler.textContent = "Нет данных на этот день";

        this.titleHandler.textContent = WeekDays[dayData.id].toUpperCase();

        const listContainer = document.createElement('div');
        listContainer.className = 'lessons-list';

        if (!dayData.lessons || dayData.lessons.length === 0) {
            const empty = document.createElement("div");
            empty.className = "weekly-empty-lessons";
            empty.textContent = "ЗАНЯТИЙ НЕТ";
            listContainer.appendChild(empty);
        } else {
            dayData.lessons.forEach(lesson => {
                listContainer.appendChild(this.formatLesson(lesson));
            });
        }

        this.contentHandler.appendChild(listContainer);
    }

    pullWeekSchedule() {
        if (!this._isValidHandlers()) return;
        this.titleHandler.textContent = "РАСПИСАНИЕ НА ВСЮ НЕДЕЛЮ";
        this.contentHandler.innerHTML = '';

        if (!this.schedule) return this.contentHandler.textContent = "Данные еще загружаются...";
        if (!this.selectedGroup) return this.contentHandler.textContent = "Выберите группу";

        const daysData = this.schedule.groups[this.selectedGroup]?.days || [];
        if (!daysData.length) return this.contentHandler.textContent = "Расписание отсутствует";

        const grid = document.createElement('div');
        grid.className = 'weekly-schedule-grid';

        daysData.forEach(dayData => {
            const card = document.createElement('div');
            card.className = 'weekly-day-card';

            const title = document.createElement('div');
            title.className = 'weekly-day-title';
            title.textContent = WeekDays[dayData.id].toUpperCase();
            card.appendChild(title);

            const listContainer = document.createElement('div');
            listContainer.className = 'weekly-lessons-list';

            if (!dayData.lessons || dayData.lessons.length === 0) {
                const empty = document.createElement("div");
                empty.className = "weekly-empty-lessons";
                empty.textContent = "ЗАНЯТИЙ НЕТ";
                listContainer.appendChild(empty);
            } else {
                dayData.lessons.forEach(lesson => {
                    listContainer.appendChild(this.formatLesson(lesson));
                });
            }

            card.appendChild(listContainer);
            grid.appendChild(card);
        });

        this.contentHandler.appendChild(grid);
    }

    formatLesson(lesson) {
        const div = document.createElement('div');

        // ИСПРАВЛЕНО: достаем свойство 'lesson' и переименовываем его в 'nextLesson'
        const { lesson: nextLesson, day } = this.getNextLesson() || {};

        const isNext = nextLesson && lesson.time === nextLesson.time && lesson.name === nextLesson.name;

        div.className = `lesson-item ${isNext ? 'next-lesson' : ''}`;

        const rawName = lesson.name || "Название не указано";
        let lessonName = this.checkLesson(rawName);
        const isMasked = lessonName !== undefined;
        if (!isMasked) lessonName = rawName;

        const injectLinks = (text, links) => {
            if (!text || text === "Название не указано" || !links?.length) return text;
            const chars = Array.from(text);
            [...links].sort((a, b) => b.start - a.start).forEach(link => {
                if (link?.uri && link.start >= 0 && link.end <= chars.length && link.start < link.end) {
                    const anchor = chars.slice(link.start, link.end).join('');
                    chars.splice(link.start, link.end - link.start, `<a href="${link.uri}" target="_blank" rel="noopener" class="lesson-link" onclick="event.stopPropagation();">${anchor}</a>`);
                }
            });
            return chars.join('');
        };

        div.innerHTML = `
        <div class="lesson-header">
            ${isNext ? `<div class="status-badge">БЛИЖАЙШАЯ ПАРА</div>` : ''}
            <span style="display: flex; justify-content: space-between; width: 100%;">
                <span class="lesson-time">${lesson.time || 'Время не указано'}</span>
                <span>
                    ${isMasked ? `<span class="drop" style="cursor:pointer; margin-left:10px; color:red; text-decoration:underline;">Сбросить</span>` : ''}
                    <span class="edit" style="cursor:pointer; margin-left:10px; color:blue; text-decoration:underline;">Изменить</span>
                </span>
            </span>
        </div>
        <div class="lesson-body">
            <div class="lesson-title ${isMasked ? 'masked' : ''}">
                ${injectLinks(lessonName, lesson.links)}
            </div>
            
            <div class="edit-zone" style="display: none; margin-top: 10px;">
                <textarea cols="40" rows="3" class="lesson-notes-input">${lessonName}</textarea>
                <div style="margin-top: 5px;">
                    <button class="save-btn">Сохранить</button>
                    <button class="cancel-btn" style="margin-left: 5px;">Отмена</button>
                </div>
            </div>
        </div>
    `;

        if (isNext) {
            div.style.backgroundColor = "#00de6f";
            div.style.opacity = "0.9";
            div.style.border = "2px solid #00d169";
        }

        const editZone = div.querySelector('.edit-zone');
        const textarea = div.querySelector('.lesson-notes-input');
        const editBtn = div.querySelector('.edit');
        const dropBtn = div.querySelector('.drop');
        const saveBtn = div.querySelector('.save-btn');
        const cancelBtn = div.querySelector('.cancel-btn');
        const controlsZone = div.querySelector('.controls-zone');

        if (editZone) {
            editZone.addEventListener('click', (e) => e.stopPropagation());
        }
        if (controlsZone) {
            controlsZone.addEventListener('click', (e) => e.stopPropagation());
        }

        const openEditor = () => {
            editZone.style.display = 'block';
            textarea.focus();
            textarea.select();
        };

        const closeEditor = () => {
            editZone.style.display = 'none';
        };

        editBtn.addEventListener('click', openEditor);
        cancelBtn.addEventListener('click', closeEditor);

        if (dropBtn) {
            dropBtn.addEventListener('click', () => {
                this.dropLesson(rawName);
            });
        }

        saveBtn.addEventListener('click', () => {
            const newName = textarea.value.trim();
            if (newName === "") {
                this.dropLesson(rawName);
            } else {
                this.maskLesson(rawName, newName);
            }
            closeEditor();
        });

        return div;
    }

    _isValidHandlers() {
        return this.titleHandler && this.contentHandler;
    }

    _clearHandlers() {
        this.titleHandler.innerHTML = '';
        this.contentHandler.innerHTML = '';
    }

    initCustomDropdown() {
        const input = document.getElementById('group-input'), dropdown = document.getElementById('custom-drop-down');
        if (!input || !dropdown) return;

        const filterGroups = () => {
            const val = input.value.trim().toUpperCase();
            dropdown.innerHTML = '';
            if (!this.schedule?.groups) return dropdown.style.display = 'none';

            const filtered = Object.keys(this.schedule.groups).filter(g => g.toUpperCase().includes(val));
            if (!filtered.length) return dropdown.style.display = 'none';

            filtered.forEach(groupName => {
                const item = document.createElement('div');
                item.className = 'dropdown-item';
                item.textContent = groupName;
                item.addEventListener('click', () => {
                    input.value = groupName;
                    this.selectedGroup = groupName;
                    localStorage.setItem("group", groupName);
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
            if (!e.target.closest('.autocomplete-wrapper')) dropdown.style.display = 'none';
        });
    }

    getNextLesson() {
        if (!this.schedule || !this.selectedGroup) return { lesson: null, day: null };

        const now = new Date();
        const currentDayId = (now.getDay() + 6) % 7;
        const timeInMinutes = now.getHours() * 60 + now.getMinutes();

        const days = this.schedule.groups[this.selectedGroup].days || [];
        const actualDay = days.find(day => day.id === currentDayId);

        if (actualDay && Array.isArray(actualDay.lessons)) {
            const nextLesson = actualDay.lessons.find(lesson => {
                if (!lesson.time || !lesson.time.includes("-")) return false;

                // Безопасный парсинг времени окончания
                const timeParts = lesson.time.split("-");
                if (timeParts.length < 2) return false;

                const [hours, minutes] = timeParts[1].split(".").map(Number);
                return (hours * 60 + minutes) > timeInMinutes;
            });

            if (nextLesson) return { lesson: nextLesson, day: actualDay };
        }

        const daysCycle = [...days, ...days];
        const currentDayIdx = days.findIndex(d => d.id === currentDayId);

        if (currentDayIdx !== -1) {
            const nextDayWithLessons = daysCycle
                .slice(currentDayIdx + 1)
                .find(day => Array.isArray(day.lessons) && day.lessons.length > 0);

            if (nextDayWithLessons && nextDayWithLessons.lessons.length > 0) {
                return { lesson: nextDayWithLessons.lessons[0], day: nextDayWithLessons };
            }
        }

        return { lesson: null, day: null };
    }



    initActualLesson() {
        const div = document.getElementById("actualLesson");
        if (!div) return;

        div.innerHTML = "";
        const {lesson, day} = this.getNextLesson() || {};

        if (!lesson) {
            div.innerHTML = `
                <div class="lesson-item design-empty" style="border: 2px solid #000000; box-shadow: 4px 4px 0px #000000; padding: 14px 16px;">
                    <div class="lesson-header">
                        <div class="status-badge empty" style="background-color: #ff0000; color: #ffffff; border: 2px solid #000000; padding: 2px 8px; font-size: 13px; text-transform: uppercase;">ПАР НЕТ</div>
                    </div>
                    <div class="lesson-body">
                        <div class="lesson-title" style="border: none; padding-top: 0; font-size: 16px; margin-top: 8px; text-transform: uppercase;">
                            НА СЕГОДНЯ И БЛИЖАЙШИЕ ДНИ ЗАНЯТИЙ НЕ НАЙДЕНО
                        </div>
                    </div>
                </div>
            `;
            return;
        }
        const lessonElement = this.formatLesson(lesson);

        div.appendChild(lessonElement);

        div.addEventListener("click", () => {
            if (!lesson || !day) {
                div.innerHTML = `
                <div class="lesson-item design-empty" style="border: 2px solid #000000; box-shadow: 4px 4px 0px #000000; padding: 14px 16px;">
                    <div class="lesson-header">
                        <div class="status-badge empty" style="background-color: #ff0000; color: #ffffff; border: 2px solid #000000; padding: 2px 8px; font-size: 13px; text-transform: uppercase;">ПАР НЕТ</div>
                    </div>
                    <div class="lesson-body">
                        <div class="lesson-title" style="border: none; padding-top: 0; font-size: 16px; margin-top: 8px; text-transform: uppercase;">
                            НА СЕГОДНЯ И БЛИЖАЙШИЕ ДНИ ЗАНЯТИЙ НЕ НАЙДЕНО
                        </div>
                    </div>
                </div>
            `;
                return;
            }

            const now = new Date();
            const actualWeekDay = (now.getDay() + 6) % 7;

            let deltaDays = day.id - actualWeekDay;
            if (day.id < actualWeekDay) {
                deltaDays += 7;
            }

            const targetDate = new Date(now);
            targetDate.setDate(now.getDate() + deltaDays);

            if (now.getMonth() !== targetDate.getMonth()) {
                const postBtn = document.getElementById("post");
                if (postBtn) postBtn.click();
            }

            const dayDivs = document.getElementsByClassName("day");
            const getDayDiv = () => {
                const targetDayString = targetDate.getDate().toString();
                for (let dayEl of dayDivs) {
                    if (dayEl.textContent.trim() === targetDayString) {
                        return dayEl;
                    }
                }
                return null;
            };

            const targetDiv = getDayDiv();
            if (targetDiv) {
                this.changeSelected(targetDiv);
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const calendar = new Calendar();
    const input = document.getElementById("group-input");

    if (input) input.value = calendar.selectedGroup;

    const changeMonth = (offset) => {
        calendar.date = new Date(calendar.date.getFullYear(), calendar.date.getMonth() + offset, 1);
        calendar.generate();
    };

    document.getElementById("prev")?.addEventListener("click", () => changeMonth(-1));
    document.getElementById("post")?.addEventListener("click", () => changeMonth(1));

    const handler = document.getElementById('schedule-handler');
    window.addEventListener('click', (e) => {
        if ((e.target.closest('.day:not(.empty)') || e.target.closest('.week-select-btn')) && window.innerWidth <= 850 && handler) {
            handler.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }, true);

    document.getElementById('close-schedule')?.addEventListener('click', () => {
        handler?.classList.remove('active');
        document.body.style.overflow = '';
    });
});