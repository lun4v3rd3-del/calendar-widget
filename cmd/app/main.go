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

	http.HandleFunc("/", handleConnections(sheetSrv))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	err := http.ListenAndServe(":"+port, nil)

	if err != nil {
		log.Fatal("Не удалось запустить сервер: ", err)
	}
}

func mustLoadEnv() {
	err := godotenv.Load(".env")
	if err != nil {
		log.Fatal(err)
	}
}
