package service

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

// Brand people pay $0.50 from email credit for every Mail Studio template they create.
// The platform root login (starter templates) is not charged.
// If IVX_PORTAL_SERVICE_TOKEN is empty, the fee is skipped so local Mail Studio still works.
func shouldChargeTemplateFee(actorEmail string) bool {
	if strings.TrimSpace(os.Getenv("IVX_PORTAL_SERVICE_TOKEN")) == "" {
		return false
	}
	root := strings.TrimSpace(os.Getenv("NOTIFUSE_ROOT_EMAIL"))
	if root != "" && strings.EqualFold(strings.TrimSpace(actorEmail), root) {
		return false
	}
	return true
}

func chargeTemplateFee(workspaceID, templateID, actorEmail string) error {
	return postTemplateFee(workspaceID, templateID, actorEmail, "charge")
}

func refundTemplateFee(workspaceID, templateID, actorEmail string) {
	_ = postTemplateFee(workspaceID, templateID, actorEmail, "refund")
}

func postTemplateFee(workspaceID, templateID, actorEmail, action string) error {
	token := strings.TrimSpace(os.Getenv("IVX_PORTAL_SERVICE_TOKEN"))
	if token == "" {
		return nil
	}
	base := strings.TrimRight(strings.TrimSpace(os.Getenv("IVX_ADMIN_API_URL")), "/")
	if base == "" {
		base = "https://api.intelli-verse-x.ai"
	}
	payload, err := json.Marshal(map[string]string{
		"appId":      workspaceID,
		"templateId": templateID,
		"action":     action,
	})
	if err != nil {
		return fmt.Errorf("could not charge the $0.50 template fee")
	}
	req, err := http.NewRequest(
		http.MethodPost,
		base+"/api/admin/portal-internal/brand-control/template-fee",
		bytes.NewReader(payload),
	)
	if err != nil {
		return fmt.Errorf("could not charge the $0.50 template fee")
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-portal-service-token", token)
	if strings.TrimSpace(actorEmail) != "" {
		req.Header.Set("x-portal-actor-email", actorEmail)
	}
	client := &http.Client{Timeout: 8 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("could not charge the $0.50 template fee: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode < 300 {
		return nil
	}
	raw, _ := io.ReadAll(io.LimitReader(res.Body, 400))
	var parsed struct {
		Message string `json:"message"`
	}
	_ = json.Unmarshal(raw, &parsed)
	if parsed.Message != "" {
		return fmt.Errorf("%s", parsed.Message)
	}
	return fmt.Errorf("template fee was refused")
}
