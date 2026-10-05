FROM golang:alpine

WORKDIR /app
COPY . .

RUN go build cmd/app/main.go

EXPOSE 8080

CMD ["./cmd/app/main"]