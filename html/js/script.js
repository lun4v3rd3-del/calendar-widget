class Calendar {
    constructor() {
        this.socket = new WebSocket("wss://calendar-widget-jn6l.onrender.com/");
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
        const year = new Date(this.date).getFullYear();
        const month = this.date.getMonth();
        const today = this.date.getDate();

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
            btn.addEventListener('click', () => this.changeSelected(week));

            week.appendChild(btn);
            return week;
        };

        let weekDiv = createWeekRow();
        const totalDays = new Date(year, month + 1, 0).getDate();

        for (let i = startDayOfWeek; i > 0; i--) {
            const emptyDiv = document.createElement('div');
            emptyDiv.classList.add('day', 'empty');
            let date = new Date(firstDayOfMonth - i * 24 * 60 * 60 * 1000);
            emptyDiv.textContent = date.getDate().toString()

            emptyDiv.addEventListener("click", () => {
                this.date = date;
                this.generate()
            })

            this.a.push(emptyDiv);
            weekDiv.appendChild(emptyDiv);
        }
        let day = 1
        for (;day <= totalDays; day++) {
            const dayDiv = document.createElement('div');
            dayDiv.classList.add('day');
            dayDiv.textContent = day;

            const currentDayObject = new Date(year, month, day);
            let dayOfWeek = currentDayObject.getDay();
            dayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

            dayDiv.dataset.dayOfWeek = dayOfWeek;

            if (day === today) {
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

        for (let i = 1; weekDiv.childElementCount <= 7 && weekDiv.childElementCount !== 1; i++) {
            const emptyDiv = document.createElement('div');
            emptyDiv.classList.add('day', 'empty');
            emptyDiv.textContent = i.toString()

            emptyDiv.addEventListener("click", () => {
                let year = this.date.getFullYear()
                let month = this.date.getMonth() + 1

                this.date = new Date(new Date(year, month, 1).getTime() + (i - 1) * 24 * 60 * 60 * 1000);
                this.generate()
            })

            this.a.push(emptyDiv);
            weekDiv.appendChild(emptyDiv);
        }

        if (weekDiv.childElementCount > 1) {
            while (weekDiv.childElementCount < 8) {
                const emptyDiv = document.createElement('div');
                emptyDiv.classList.add('day', 'empty');
                weekDiv.appendChild(emptyDiv);
            }
            this.calendarDays.appendChild(weekDiv);
        }

        if (this.shedule && this.selectedElement) {
            this.pullShedule(this.selectedElement);
        }
    }



    changeSelected(div) {
        if (div.classList.contains("calendar-week")) {
            this.pullWeekShedule(div);
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
        const container = document.createElement("div")
        container.classList.add("weekly-day-card")

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
            dayData.lessons.forEach(lesson => {
                container.appendChild(this.formatLesson(lesson));
            });
        } else {
            contentHandler.textContent = "ЗАНЯТИЙ НЕТ";
        }

        contentHandler.appendChild(container)
    }

    formatLesson(lesson) {
        const lessonDiv = document.createElement('div');
        lessonDiv.className = 'lesson-item';
        lessonDiv.style.marginBottom = '15px';

        let lessonName = this.checkLesson(lesson.name)
        let isMasked = true;

        if (this.checkLesson(lesson.name) === undefined) {
            if (lesson.name === null) {
                lessonName = "Название не указано";
            }
            else {
                lessonName = lesson.name;
            }
            isMasked = false;
        }

        console.log(lesson.name + " " + isMasked)

        lessonDiv.innerHTML = `
                    <div class="lesson-header" style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <div style="font-size: 11px; color: #777; margin-bottom: 4px;">[ ВРЕМЯ: ${lesson.time || '—'} ]</div>
                        <span style="display: flex; gap: 8px;">
                            <div class="drop-trigger" style="color: dimgray; text-decoration: underline; cursor: pointer; display: ${isMasked ? 'inline-block' : 'none'};">сбросить</div>
                            <div class="edit-trigger" style="color: blue; text-decoration: underline; cursor: pointer;">изменить</div>  
                        </span>
                    </div>
                    <div class="lesson-name" style="font-style: italic; line-height: 1.3;">${lessonName}</div>
                   
                    <div class="edit-form" style="display: none; margin-top: 10px; flex-direction: column; gap: 8px;">
                        <textarea class="edit-input" style="width: 100%; padding: 6px; box-sizing: border-box; font-family: inherit; font-size: 13px;" rows="3">${lesson.name || ''}</textarea>
                        <button class="save-btn" style="align-self: flex-end; padding: 4px 12px; cursor: pointer;">Сохранить</button>
                    </div>
                `;


        const editTrigger = lessonDiv.querySelector('.edit-trigger');
        const dropTrigger = lessonDiv.querySelector('.drop-trigger');
        const editForm = lessonDiv.querySelector('.edit-form');
        const editInput = lessonDiv.querySelector('.edit-input');
        const saveBtn = lessonDiv.querySelector('.save-btn');
        const lessonNameDiv = lessonDiv.querySelector('.lesson-name');

        editTrigger.addEventListener('click', () => {
            editTrigger.style.display = 'none';
            editForm.style.display = 'flex';

            editInput.focus();
        });

        dropTrigger.addEventListener('click', () => {
            dropTrigger.style.display = 'none';
            this.dropLesson(lesson.name);
            lessonNameDiv.innerHTML = lesson.name;

            console.log(lesson.name);
            if (this.selectedElement.classList.contains("day")) {
                this.pullShedule(this.selectedElement);
            }
            else if (this.selectedElement.classList.contains("day")) {
                this.pullWeekShedule(this.selectedElement);
            }
        });

        saveBtn.addEventListener('click', () => {
            const rawData = lesson.name;
            const newData = editInput.value.trim();

            dropTrigger.style.display = 'inline-block';

            if (typeof this.maskLesson === 'function') {
                this.maskLesson(rawData, newData);
            } else if (typeof maskLesson === 'function') {
                maskLesson(rawData, newData);
            } else {
                localStorage.setItem(rawData, newData);
            }

            lessonNameDiv.textContent = newData || 'Название не указано';
            editForm.style.display = 'none';
            editTrigger.style.display = 'block';

            if (this.selectedElement.classList.contains("day")) {
                this.pullShedule(this.selectedElement);
            }
            else if (this.selectedElement.classList.contains("day")) {
                this.pullWeekShedule(this.selectedElement);
            }
        });

        return lessonDiv
    }

    maskLesson(rawData, newData) {
        const masksData = localStorage.getItem('schedule_masks');
        let masksMap = masksData ? JSON.parse(masksData) : {};

        masksMap[rawData] = newData;

        localStorage.setItem('schedule_masks', JSON.stringify(masksMap));
    }

    checkLesson(lessonName) {
        const masksData = localStorage.getItem('schedule_masks');
        let masksMap = masksData ? JSON.parse(masksData) : {};

        return masksMap[lessonName]
    }

    dropLesson(lessonName) {
        const masksData = localStorage.getItem('schedule_masks');
        let masksMap = masksData ? JSON.parse(masksData) : {};

        delete masksMap[lessonName];

        localStorage.setItem('schedule_masks', JSON.stringify(masksMap));
    }

    pullWeekShedule(weekDiv) {
        const titleHandler = document.getElementsByClassName("schedule-title")[0];
        const contentHandler = document.getElementsByClassName("schedule-content")[0];

        if (!titleHandler || !contentHandler) return;

        titleHandler.textContent = "РАСПИСАНИЕ НА ВСЮ НЕДЕЛЮ";
        contentHandler.innerHTML = '';

        if (!this.shedule) {
            contentHandler.textContent = "Данные еще загружаются...";
            return;
        }

        const groupData = this.shedule.groups["11-505"];
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
                    dropdown.style.display = 'none'

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
    calendar.generate();
    calendar.initCustomDropdown();

    let prevButton = document.getElementById("prev")
    let postButton = document.getElementById("post")

    prevButton.addEventListener("click", () => {
        let year = calendar.date.getFullYear()
        let month = calendar.date.getMonth()
        calendar.date = new Date(year, month + 1, 1);
        calendar.generate();
    });

    postButton.addEventListener("click", () => {
        let year = calendar.date.getFullYear();
        let month = calendar.date.getMonth();
        calendar.date = new Date(year, month - 1, 1);
        calendar.generate();
    });
});
