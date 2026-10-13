package migrations

import (
	"context"
	"fmt"

	"github.com/Notifuse/notifuse/config"
	"github.com/Notifuse/notifuse/internal/domain"
)

// V33Migration stores broadcast attachment metadata.
//
// File bytes stay in message_attachments, keyed by checksum, so one PDF is
// stored once and attached to every recipient. The broadcasts.attachments
// column holds only that metadata (checksum, filename, content type).
type V33Migration struct{}

func (m *V33Migration) GetMajorVersion() float64 {
	return 33.0
}

func (m *V33Migration) HasSystemUpdate() bool {
	return false
}

func (m *V33Migration) HasWorkspaceUpdate() bool {
	return true
}

func (m *V33Migration) ShouldRestartServer() bool {
	return false
}

func (m *V33Migration) UpdateSystem(ctx context.Context, cfg *config.Config, db DBExecutor) error {
	return nil
}

func (m *V33Migration) UpdateWorkspace(ctx context.Context, cfg *config.Config, workspace *domain.Workspace, db DBExecutor) error {
	_, err := db.ExecContext(ctx, `
		ALTER TABLE broadcasts
		ADD COLUMN IF NOT EXISTS attachments JSONB
	`)
	if err != nil {
		return fmt.Errorf("failed to add attachments column to broadcasts for workspace %s: %w", workspace.ID, err)
	}
	return nil
}

func init() {
	Register(&V33Migration{})
}
