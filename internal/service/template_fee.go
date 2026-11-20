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
// Platform workspace (intelliversex) root login is not charged (starter / ops templates).
// Brand workspaces always charge when the portal fee token is configured — even if the
// actor is root SSO into that brand (otherwise brand creates were free).
// If the portal service token is empty, the fee is skipped so local Mail Studio still works.
func portalServiceToken() string {
	if t := strings.TrimSpace(os.Getenv("IVX_PORTAL_SERVICE_TOKEN")); t != "" {
		return t
	}
	return strings.TrimSpace(os.Getenv("PORTAL_SERVICE_TOKEN"))
}

func shouldChargeTemplateFee(actorEmail, workspaceID string) bool {
	if portalServiceToken() == "" {
		return false
	}
	ws := strings.ToLower(strings.TrimSpace(workspaceID))
	if ws != "" && ws != "intelliversex" {
		return true
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
	token := portalServiceToken()
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
