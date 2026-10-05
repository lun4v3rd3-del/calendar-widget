package main

import (
	"awesomeProject10/internal/infrastucture/interfaces"
	"awesomeProject10/internal/usecase"
	"context"
	"encoding/json"
	"fmt"
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

func main() {
	fmt.Println("initial...")
	mustLoadEnv()
	sheetSrv := usecase.NewSheetService(os.Getenv("GSHEET_SPREADSHEET_ID"), os.Getenv("GSHEET_API_KEY"))

	http.HandleFunc("/ws", handleConnections(sheetSrv))

	wd, err := os.Getwd()
	if err != nil {
		log.Fatal("Не удалось получить рабочую директорию:", err)
	}

	fs := http.FileServer(http.Dir(wd + "/html"))
	http.Handle("/css/", fs)
	http.Handle("/js/", fs)

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" || r.URL.Path == "/index.html" {
			http.ServeFile(w, r, wd+"/html/index.html")
			return
		}
		http.NotFound(w, r)
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	err = http.ListenAndServe(":"+port, nil)
	if err != nil {
		log.Fatal("Не удалось запустить сервер: ", err)
	}
}

func mustLoadEnv() {
	_ = godotenv.Load(".env")
}
