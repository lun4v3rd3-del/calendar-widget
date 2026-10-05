package main

import (
	"awesomeProject10/internal/infrastucture/interfaces"
	"awesomeProject10/internal/usecase"
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net/http"
	"os"

	"github.com/gorilla/websocket"
	"github.com/joho/godotenv"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func handleConnections(sheetService interfaces.SheetService) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		ws, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Println("Ошибка при апгрейде соединения:", err)
			return
		}
		defer ws.Close()
		log.Println("Клиент успешно подключился!")

		for {
			messageType, messagePayload, err := ws.ReadMessage()
			if err != nil {
				log.Println("Клиент отключился или произошла ошибка:", err)
				break
			}

			clientMessage := string(messagePayload)
			log.Printf("Получено сообщение от клиента: %s\n", clientMessage)

			if clientMessage == "_get_schedule" {
				jsonSheet, _ := sheetService.GetSheet(context.Background())
				responseHTML, _ := json.MarshalIndent(jsonSheet, "", "\t")

				err = ws.WriteMessage(messageType, responseHTML)
				if err != nil {
					log.Println("Ошибка отправки ответа:", err)
					break
				}
			}
		}

	}
}

//go:embed html
var htmlFiles embed.FS

func main() {
	fmt.Println("initial...")
	mustLoadEnv()
	sheetSrv, _ := usecase.NewSheetService(context.Background(), os.Getenv("GSHEET_SPREADSHEET_ID"), os.Getenv("GSHEET_API_KEY"))

	sheet, _ := sheetSrv.GetSheet(context.Background())
	sheetRaw, _ := json.MarshalIndent(sheet, "", "\t")

	println(string(sheetRaw))

	publicFS, err := fs.Sub(htmlFiles, "html")
	if err != nil {
		log.Fatal("Ошибка создания подсистемы файлов embed:", err)
	}

	http.HandleFunc("/ws", handleConnections(sheetSrv))

	fileServer := http.FileServer(http.FS(publicFS))
	http.Handle("/css/", fileServer)
	http.Handle("/js/", fileServer)

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" || r.URL.Path == "/index.html" {
			indexHTML, err := publicFS.Open("index.html")
			if err != nil {
				http.Error(w, "Файл index.html не найден в сборке", http.StatusInternalServerError)
				return
			}
			defer indexHTML.Close()

			stat, _ := indexHTML.Stat()
			http.ServeContent(w, r, "index.html", stat.ModTime(), indexHTML.(io.ReadSeeker))
			return
		}
		http.NotFound(w, r)
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("Сервер успешно запущен на порту %s. Файлы встроенны успешно.\n", port)
	err = http.ListenAndServe(":"+port, nil)
	if err != nil {
		log.Fatal("Не удалось запустить сервер: ", err)
	}
}

func mustLoadEnv() {
	_ = godotenv.Load(".env")
}
