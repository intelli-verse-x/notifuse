package migrations

import (
	"context"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/Notifuse/notifuse/config"
	"github.com/Notifuse/notifuse/internal/domain"
)

func TestV33Migration_GetMajorVersion(t *testing.T) {
	m := &V33Migration{}
	assert.Equal(t, 33.0, m.GetMajorVersion())
}

func TestV33Migration_HasSystemUpdate(t *testing.T) {
	m := &V33Migration{}
	assert.False(t, m.HasSystemUpdate())
}

func TestV33Migration_HasWorkspaceUpdate(t *testing.T) {
	m := &V33Migration{}
	assert.True(t, m.HasWorkspaceUpdate())
}

func TestV33Migration_ShouldRestartServer(t *testing.T) {
	m := &V33Migration{}
	assert.False(t, m.ShouldRestartServer())
}

func TestV33Migration_UpdateSystem_NoOp(t *testing.T) {
	m := &V33Migration{}
	assert.NoError(t, m.UpdateSystem(context.Background(), &config.Config{}, nil))
}

func TestV33Migration_UpdateWorkspace_Success(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	mock.ExpectExec(`ALTER TABLE broadcasts\s+ADD COLUMN IF NOT EXISTS attachments`).
		WillReturnResult(sqlmock.NewResult(0, 0))

	m := &V33Migration{}
	err = m.UpdateWorkspace(context.Background(), &config.Config{},
		&domain.Workspace{ID: "ws_test"}, db)
	assert.NoError(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestV33Migration_UpdateWorkspace_Error(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	mock.ExpectExec(`ALTER TABLE broadcasts`).WillReturnError(assert.AnError)

	m := &V33Migration{}
	err = m.UpdateWorkspace(context.Background(), &config.Config{},
		&domain.Workspace{ID: "ws_test"}, db)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to add attachments column to broadcasts")
}

func TestV33Migration_Registered(t *testing.T) {
	for _, m := range GetRegisteredMigrations() {
		if m.GetMajorVersion() == 33.0 {
			return
		}
	}
	t.Fatal("V33Migration not registered")
}
