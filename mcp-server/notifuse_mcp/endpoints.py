"""Declarative registry of every Notifuse HTTP endpoint.

Each :class:`Endpoint` becomes one MCP tool. The registry is the single source
of truth for tool names, HTTP method/path, parameter location (query string vs
JSON body) and human-readable docs. Keeping it data-driven means the MCP server
itself is tiny and adding/adjusting coverage is a one-line change.

Convention (mirrors the Notifuse Go handlers):
  * GET  endpoints read parameters from the query string.
  * POST endpoints read parameters from a JSON body, except a handful that read
    ``workspace_id`` from the query string (blog endpoints) - those params are
    placed in ``query``.

Complex nested values (contact objects, email blocks, segment trees, automation
definitions, analytics queries, ...) are typed as ``object``/``array`` and the
tool accepts free-form additional properties so nothing is ever un-callable.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class Param:
    name: str
    type: str = "string"  # string | integer | number | boolean | object | array
    required: bool = False
    desc: str = ""
    enum: list[str] | None = None
    item_type: str = "string"  # used when type == "array"

    def schema(self) -> dict[str, Any]:
        s: dict[str, Any] = {"type": self.type}
        if self.desc:
            s["description"] = self.desc
        if self.enum:
            s["enum"] = self.enum
        if self.type == "array":
            s["items"] = {"type": self.item_type}
        if self.type == "object":
            s["additionalProperties"] = True
        return s


@dataclass
class Endpoint:
    name: str
    method: str
    path: str
    summary: str
    query: list[Param] = field(default_factory=list)
    body: list[Param] = field(default_factory=list)
    # When True the tool allows extra (undocumented/forward-compat) properties.
    freeform: bool = True
    # When False no auth header is required (public endpoints).
    auth: bool = True
    tag: str = "misc"


def P(name, type="string", required=False, desc="", enum=None, item_type="string") -> Param:
    return Param(name, type, required, desc, enum, item_type)


# Shared params -------------------------------------------------------------
WID = P("workspace_id", required=True, desc="The workspace ID this operation targets.")
WID_OPT = P("workspace_id", desc="The workspace ID (falls back to NOTIFUSE_WORKSPACE_ID).")


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------
ENDPOINTS: list[Endpoint] = [
    # ----- Setup (no auth) -------------------------------------------------
    Endpoint("setup_status", "GET", "/api/setup.status",
             "Get installation/setup status of the Notifuse instance.",
             auth=False, tag="setup"),
    Endpoint("setup_initialize", "POST", "/api/setup.initialize",
             "Run the first-time setup wizard (root user, SMTP, telemetry, SMTP relay).",
             auth=False, tag="setup", body=[
                 P("root_email", required=True, desc="Root admin email."),
                 P("api_endpoint", required=True, desc="Public URL of this Notifuse instance."),
                 P("smtp_host"), P("smtp_port", "integer"), P("smtp_username"),
                 P("smtp_password"), P("smtp_from_email"), P("smtp_from_name"),
                 P("smtp_use_tls", "boolean"), P("smtp_ehlo_hostname"),
                 P("telemetry_enabled", "boolean"), P("check_for_updates", "boolean"),
                 P("smtp_relay_enabled", "boolean"), P("smtp_relay_domain"),
                 P("smtp_relay_port", "integer"), P("smtp_relay_tls_cert_base64"),
                 P("smtp_relay_tls_key_base64"),
             ]),
    Endpoint("setup_test_smtp", "POST", "/api/setup.testSmtp",
             "Test SMTP connection settings during setup.",
             auth=False, tag="setup", body=[
                 P("smtp_host", required=True), P("smtp_port", "integer", required=True),
                 P("smtp_username"), P("smtp_password"),
                 P("smtp_use_tls", "boolean"), P("smtp_ehlo_hostname"),
             ]),

    # ----- System settings (root user only; v28.2+) ------------------------
    Endpoint("settings_get", "GET", "/api/settings.get",
             "Get current system settings (root user only). Sensitive values are masked.",
             tag="settings"),
    Endpoint("settings_update", "POST", "/api/settings.update",
             "Update system settings (root user only). WARNING: this triggers a graceful "
             "server restart to reload configuration. Send masked sentinel values unchanged "
             "to retain existing secrets.", tag="settings", body=[
                 P("root_email"), P("api_endpoint"),
                 P("smtp_host"), P("smtp_port", "integer"), P("smtp_username"),
                 P("smtp_password"), P("smtp_from_email"), P("smtp_from_name"),
                 P("smtp_use_tls", "boolean"), P("smtp_ehlo_hostname"),
                 P("telemetry_enabled", "boolean"), P("check_for_updates", "boolean"),
                 P("smtp_bridge_enabled", "boolean"), P("smtp_bridge_domain"),
                 P("smtp_bridge_port", "integer"),
                 P("smtp_bridge_tls_cert_base64"), P("smtp_bridge_tls_key_base64"),
             ]),
    Endpoint("settings_test_smtp", "POST", "/api/settings.testSmtp",
             "Test SMTP connection settings (root user only).", tag="settings", body=[
                 P("smtp_host", required=True), P("smtp_port", "integer", required=True),
                 P("smtp_username"), P("smtp_password"),
                 P("smtp_use_tls", "boolean"), P("smtp_ehlo_hostname"),
             ]),

    # ----- User / auth -----------------------------------------------------
    Endpoint("user_signin", "POST", "/api/user.signin",
             "Request a magic-link sign-in code for an email (console login).",
             auth=False, tag="auth", body=[P("email", required=True)]),
    Endpoint("user_verify", "POST", "/api/user.verify",
             "Verify a sign-in code and obtain a user JWT. The token is stored as the "
             "active bearer token for subsequent tool calls.",
             auth=False, tag="auth", body=[
                 P("email", required=True), P("code", required=True),
             ]),
    Endpoint("user_root_signin", "POST", "/api/user.rootSignin",
             "Programmatic root sign-in using an HMAC signature. Prefer the "
             "notifuse_root_signin helper which computes the signature for you.",
             auth=False, tag="auth", body=[
                 P("email", required=True),
                 P("timestamp", "integer", required=True, desc="Unix seconds, within 60s of server time."),
                 P("signature", required=True, desc="hex HMAC-SHA256 of 'email:timestamp' with SECRET_KEY."),
             ]),
    Endpoint("user_me", "GET", "/api/user.me",
             "Get the current authenticated user and their workspaces.", tag="auth"),
    Endpoint("user_logout", "POST", "/api/user.logout",
             "Invalidate the current user session.", tag="auth"),
    Endpoint("user_update_language", "POST", "/api/user.updateLanguage",
             "Update the authenticated user's preferred language (console UI + system emails).",
             tag="auth", body=[P("language", required=True, desc="Language code, e.g. 'en', 'fr'.")]),

    # ----- Workspaces ------------------------------------------------------
    Endpoint("workspaces_list", "GET", "/api/workspaces.list",
             "List all workspaces the authenticated user belongs to.", tag="workspaces"),
    Endpoint("workspaces_get", "GET", "/api/workspaces.get",
             "Get a single workspace by ID.", tag="workspaces",
             query=[P("id", required=True, desc="Workspace ID.")]),
    Endpoint("workspaces_create", "POST", "/api/workspaces.create",
             "Create a new workspace.", tag="workspaces", body=[
                 P("id", required=True, desc="Workspace ID (slug)."),
                 P("name", required=True),
                 P("settings", "object", desc="WorkspaceSettings object (timezone, website_url, logo_url, cover_url, email providers, etc.)."),
             ]),
    Endpoint("workspaces_update", "POST", "/api/workspaces.update",
             "Update a workspace's name and settings.", tag="workspaces", body=[
                 P("id", required=True), P("name", required=True),
                 P("settings", "object", desc="WorkspaceSettings object."),
             ]),
    Endpoint("workspaces_delete", "POST", "/api/workspaces.delete",
             "Delete a workspace.", tag="workspaces", body=[P("id", required=True)]),
    Endpoint("workspaces_members", "GET", "/api/workspaces.members",
             "List members of a workspace (with emails).", tag="workspaces",
             query=[P("id", required=True, desc="Workspace ID.")]),
    Endpoint("workspaces_invite_member", "POST", "/api/workspaces.inviteMember",
             "Invite a member to a workspace by email.", tag="workspaces", body=[
                 WID, P("email", required=True),
                 P("permissions", "object", desc="UserPermissions object (per-resource read/write flags)."),
             ]),
    Endpoint("workspaces_create_api_key", "POST", "/api/workspaces.createAPIKey",
             "Create a long-lived API key for a workspace (owner only). Returns a "
             "bearer token which is stored as the active token.", tag="workspaces", body=[
                 WID, P("email_prefix", required=True, desc="Prefix for the API key's service email."),
             ]),
    Endpoint("workspaces_remove_member", "POST", "/api/workspaces.removeMember",
             "Remove a member from a workspace.", tag="workspaces", body=[
                 WID, P("user_id", required=True),
             ]),
    Endpoint("workspaces_delete_invitation", "POST", "/api/workspaces.deleteInvitation",
             "Delete a pending workspace invitation.", tag="workspaces", body=[
                 P("invitation_id", required=True),
             ]),
    Endpoint("workspaces_set_user_permissions", "POST", "/api/workspaces.setUserPermissions",
             "Set a member's permissions in a workspace.", tag="workspaces", body=[
                 WID, P("user_id", required=True),
                 P("permissions", "object", required=True, desc="UserPermissions object."),
             ]),
    Endpoint("workspaces_set_custom_field_labels", "POST", "/api/workspaces.setCustomFieldLabels",
             "Set human-readable labels for a workspace's custom contact fields.",
             tag="workspaces", body=[
                 WID,
                 P("custom_field_labels", "object", required=True,
                   desc="Map of custom field key -> label, e.g. {\"custom_string_1\": \"Company\"}."),
             ]),
    Endpoint("workspaces_set_blog_settings", "POST", "/api/workspaces.setBlogSettings",
             "Enable/disable and configure the workspace blog.", tag="workspaces", body=[
                 WID, P("blog_enabled", "boolean", required=True),
                 P("blog_settings", "object", desc="BlogSettings object (domain, title, theme, etc.)."),
             ]),
    Endpoint("workspaces_verify_invitation_token", "POST", "/api/workspaces.verifyInvitationToken",
             "Verify a workspace invitation token (public).", auth=False, tag="workspaces",
             body=[P("token", required=True)]),
    Endpoint("workspaces_accept_invitation", "POST", "/api/workspaces.acceptInvitation",
             "Accept a workspace invitation token and join (public).", auth=False, tag="workspaces",
             body=[P("token", required=True)]),
    Endpoint("workspaces_create_integration", "POST", "/api/workspaces.createIntegration",
             "Add an integration (email provider, Supabase, LLM, Firecrawl) to a workspace.",
             tag="workspaces", body=[
                 WID, P("name", required=True),
                 P("type", required=True, desc="Integration type, e.g. email, supabase, llm, firecrawl."),
                 P("provider", "object", desc="EmailProvider config (for email integrations)."),
                 P("supabase_settings", "object"), P("llm_provider", "object"),
                 P("firecrawl_settings", "object"),
             ]),
    Endpoint("workspaces_update_integration", "POST", "/api/workspaces.updateIntegration",
             "Update an existing workspace integration.", tag="workspaces", body=[
                 WID, P("integration_id", required=True), P("name"),
                 P("provider", "object"), P("supabase_settings", "object"),
                 P("llm_provider", "object"), P("firecrawl_settings", "object"),
             ]),
    Endpoint("workspaces_delete_integration", "POST", "/api/workspaces.deleteIntegration",
             "Delete a workspace integration.", tag="workspaces", body=[
                 WID, P("integration_id", required=True),
             ]),

    # ----- Contacts --------------------------------------------------------
    Endpoint("contacts_list", "GET", "/api/contacts.list",
             "List/search contacts with filtering and cursor pagination.", tag="contacts", query=[
                 WID,
                 P("email", desc="Filter by email (partial, case-insensitive)."),
                 P("external_id"), P("first_name"), P("last_name"), P("full_name"),
                 P("phone"), P("country"), P("language"),
                 P("list_id", desc="Filter by list membership."),
                 P("contact_list_status", desc="active|pending|unsubscribed|bounced|complained."),
                 P("segments", "array", desc="Filter by segment IDs."),
                 P("with_contact_lists", "boolean", desc="Include the contact's list subscriptions."),
                 P("limit", "integer"), P("cursor"),
             ]),
    Endpoint("contacts_count", "GET", "/api/contacts.count",
             "Count contacts matching filters.", tag="contacts",
             query=[WID, P("list_id"), P("contact_list_status")]),
    Endpoint("contacts_get_by_email", "GET", "/api/contacts.getByEmail",
             "Get a single contact by email.", tag="contacts",
             query=[WID, P("email", required=True), P("with_contact_lists", "boolean")]),
    Endpoint("contacts_get_by_external_id", "GET", "/api/contacts.getByExternalID",
             "Get a single contact by external ID.", tag="contacts",
             query=[WID, P("external_id", required=True), P("with_contact_lists", "boolean")]),
    Endpoint("contacts_upsert", "POST", "/api/contacts.upsert",
             "Create or update a contact by email.", tag="contacts", body=[
                 WID,
                 P("contact", "object", required=True,
                   desc="Contact object. Must include 'email'. Optional: external_id, first_name, "
                        "last_name, phone, timezone, language, country, custom_string_1..5, "
                        "custom_number_1..5, custom_datetime_1..5, custom_json_1..5, etc."),
             ]),
    Endpoint("contacts_import", "POST", "/api/contacts.import",
             "Batch import/upsert contacts.", tag="contacts", body=[
                 WID, P("contacts", "array", item_type="object", required=True,
                        desc="Array of contact objects (each requires 'email')."),
             ]),
    Endpoint("contacts_delete", "POST", "/api/contacts.delete",
             "Delete a contact by email.", tag="contacts", body=[
                 WID, P("email", required=True),
             ]),

    # ----- Contact lists ---------------------------------------------------
    Endpoint("contact_lists_get_by_ids", "GET", "/api/contactLists.getByIDs",
             "Get a single contact-list relationship.", tag="contact_lists",
             query=[WID, P("email", required=True), P("list_id", required=True)]),
    Endpoint("contact_lists_get_contacts_by_list", "GET", "/api/contactLists.getContactsByList",
             "Get contacts belonging to a list.", tag="contact_lists",
             query=[WID, P("list_id", required=True)]),
    Endpoint("contact_lists_get_lists_by_contact", "GET", "/api/contactLists.getListsByContact",
             "Get the lists a contact is subscribed to.", tag="contact_lists",
             query=[WID, P("email", required=True)]),
    Endpoint("contact_lists_update_status", "POST", "/api/contactLists.updateStatus",
             "Update a contact's subscription status on a list.", tag="contact_lists", body=[
                 WID, P("email", required=True), P("list_id", required=True),
                 P("status", required=True, enum=["active", "pending", "unsubscribed", "bounced", "complained"]),
             ]),
    Endpoint("contact_lists_remove_contact", "POST", "/api/contactLists.removeContact",
             "Remove a contact from a list.", tag="contact_lists", body=[
                 WID, P("email", required=True), P("list_id", required=True),
             ]),

    # ----- Lists -----------------------------------------------------------
    Endpoint("lists_list", "GET", "/api/lists.list", "List all lists in a workspace.",
             tag="lists", query=[WID]),
    Endpoint("lists_get", "GET", "/api/lists.get", "Get a single list by ID.",
             tag="lists", query=[WID, P("id", required=True)]),
    Endpoint("lists_stats", "GET", "/api/lists.stats", "Get subscription statistics for a list.",
             tag="lists", query=[WID, P("id", required=True)]),
    Endpoint("lists_create", "POST", "/api/lists.create", "Create a list.", tag="lists", body=[
        WID, P("id", required=True), P("name", required=True),
        P("is_double_optin", "boolean"), P("is_public", "boolean"),
        P("description"), P("double_optin_template", "object", desc="TemplateReference {id, version}."),
    ]),
    Endpoint("lists_update", "POST", "/api/lists.update", "Update a list.", tag="lists", body=[
        WID, P("id", required=True), P("name", required=True),
        P("is_double_optin", "boolean"), P("is_public", "boolean"),
        P("description"), P("double_optin_template", "object"),
    ]),
    Endpoint("lists_delete", "POST", "/api/lists.delete", "Delete a list.", tag="lists",
             body=[WID, P("id", required=True)]),
    Endpoint("lists_subscribe", "POST", "/api/lists.subscribe",
             "Subscribe a contact to one or more lists (authenticated).", tag="lists", body=[
                 WID,
                 P("contact", "object", required=True, desc="Contact object (must include 'email')."),
                 P("list_ids", "array", required=True, desc="List IDs to subscribe to."),
             ]),

    # ----- Segments --------------------------------------------------------
    Endpoint("segments_list", "GET", "/api/segments.list", "List segments.", tag="segments",
             query=[WID, P("with_count", "boolean", desc="Include contact counts (can be expensive).")]),
    Endpoint("segments_get", "GET", "/api/segments.get", "Get a segment by ID.", tag="segments",
             query=[WID, P("id", required=True)]),
    Endpoint("segments_create", "POST", "/api/segments.create", "Create a segment.", tag="segments", body=[
        WID, P("id", required=True), P("name", required=True), P("color"),
        P("timezone"), P("tree", "object", required=True,
                          desc="TreeNode boolean expression tree defining segment membership."),
    ]),
    Endpoint("segments_update", "POST", "/api/segments.update", "Update a segment.", tag="segments", body=[
        WID, P("id", required=True), P("name", required=True), P("color"),
        P("timezone"), P("tree", "object", required=True),
    ]),
    Endpoint("segments_delete", "POST", "/api/segments.delete", "Delete a segment.", tag="segments",
             body=[WID, P("id", required=True)]),
    Endpoint("segments_rebuild", "POST", "/api/segments.rebuild",
             "Recompute membership of a segment.", tag="segments", body=[WID, P("id", required=True)]),
    Endpoint("segments_preview", "POST", "/api/segments.preview",
             "Preview how many contacts a segment tree would match.", tag="segments", body=[
                 WID, P("tree", "object", required=True), P("timezone"),
             ]),
    Endpoint("segments_contacts", "GET", "/api/segments.contacts",
             "List contacts that belong to a segment.", tag="segments",
             query=[WID, P("id", required=True), P("limit", "integer"), P("offset", "integer")]),

    # ----- Templates -------------------------------------------------------
    Endpoint("templates_list", "GET", "/api/templates.list", "List templates.", tag="templates",
             query=[WID, P("category")]),
    Endpoint("templates_get", "GET", "/api/templates.get", "Get a template (optionally a version).",
             tag="templates", query=[WID, P("id", required=True), P("version", "integer")]),
    Endpoint("templates_create", "POST", "/api/templates.create", "Create a template.", tag="templates", body=[
        WID, P("id", required=True), P("name", required=True),
        P("channel", desc="e.g. 'email'."), P("category"),
        P("email", "object", desc="EmailTemplate {subject, from, reply_to, visual_editor_tree (MJML block), ...}."),
        P("test_data", "object"), P("settings", "object"),
    ]),
    Endpoint("templates_update", "POST", "/api/templates.update", "Update a template.", tag="templates", body=[
        WID, P("id", required=True), P("name", required=True),
        P("channel"), P("category"), P("email", "object"),
        P("test_data", "object"), P("settings", "object"),
    ]),
    Endpoint("templates_delete", "POST", "/api/templates.delete", "Delete a template.", tag="templates",
             body=[WID, P("id", required=True)]),
    Endpoint("templates_compile", "POST", "/api/templates.compile",
             "Compile a template (MJML + Liquid) to HTML with provided test data.", tag="templates", body=[
                 WID,
                 P("visual_editor_tree", "object", desc="MJML EmailBlock tree to compile."),
                 P("test_data", "object", desc="Liquid template data."),
                 P("tracking_enabled", "boolean"),
             ]),

    # ----- Template blocks -------------------------------------------------
    Endpoint("template_blocks_list", "GET", "/api/templateBlocks.list",
             "List reusable template blocks.", tag="template_blocks", query=[WID]),
    Endpoint("template_blocks_get", "GET", "/api/templateBlocks.get",
             "Get a reusable template block.", tag="template_blocks",
             query=[WID, P("id", required=True)]),
    Endpoint("template_blocks_create", "POST", "/api/templateBlocks.create",
             "Create a reusable template block.", tag="template_blocks", body=[
                 WID, P("name", required=True),
                 P("block", "object", required=True, desc="MJML EmailBlock definition."),
             ]),
    Endpoint("template_blocks_update", "POST", "/api/templateBlocks.update",
             "Update a reusable template block.", tag="template_blocks", body=[
                 WID, P("id", required=True), P("name", required=True),
                 P("block", "object", required=True),
             ]),
    Endpoint("template_blocks_delete", "POST", "/api/templateBlocks.delete",
             "Delete a reusable template block.", tag="template_blocks",
             body=[WID, P("id", required=True)]),

    # ----- Broadcasts ------------------------------------------------------
    Endpoint("broadcasts_list", "GET", "/api/broadcasts.list", "List broadcasts.", tag="broadcasts",
             query=[WID, P("status"), P("limit", "integer"), P("offset", "integer")]),
    Endpoint("broadcasts_get", "GET", "/api/broadcasts.get", "Get a broadcast by ID.", tag="broadcasts",
             query=[WID, P("id", required=True)]),
    Endpoint("broadcasts_create", "POST", "/api/broadcasts.create", "Create a broadcast.", tag="broadcasts", body=[
        WID, P("name", required=True),
        P("audience", "object", desc="Audience selection (lists, segments, exclusions)."),
        P("schedule", "object", desc="Schedule config (send now / scheduled time / timezone)."),
        P("test_settings", "object", desc="A/B test variations and settings."),
        P("utm_parameters", "object"), P("metadata", "object"),
    ]),
    Endpoint("broadcasts_update", "POST", "/api/broadcasts.update", "Update a broadcast.", tag="broadcasts", body=[
        WID, P("id", required=True), P("name"),
        P("audience", "object"), P("schedule", "object"),
        P("test_settings", "object"), P("utm_parameters", "object"), P("metadata", "object"),
    ]),
    Endpoint("broadcasts_schedule", "POST", "/api/broadcasts.schedule",
             "Schedule or immediately send a broadcast.", tag="broadcasts", body=[
                 WID, P("id", required=True),
                 P("send_now", "boolean"),
                 P("scheduled_date", desc="Date (YYYY-MM-DD) when send_now is false."),
                 P("scheduled_time", desc="Time (HH:MM) when send_now is false."),
                 P("timezone"), P("use_recipient_timezone", "boolean"),
             ]),
    Endpoint("broadcasts_pause", "POST", "/api/broadcasts.pause", "Pause a sending broadcast.",
             tag="broadcasts", body=[WID, P("id", required=True)]),
    Endpoint("broadcasts_resume", "POST", "/api/broadcasts.resume", "Resume a paused broadcast.",
             tag="broadcasts", body=[WID, P("id", required=True)]),
    Endpoint("broadcasts_cancel", "POST", "/api/broadcasts.cancel", "Cancel a broadcast.",
             tag="broadcasts", body=[WID, P("id", required=True)]),
    Endpoint("broadcasts_send_to_individual", "POST", "/api/broadcasts.sendToIndividual",
             "Send a broadcast to a single recipient (e.g. preview/test send).", tag="broadcasts", body=[
                 WID, P("broadcast_id", required=True), P("recipient_email", required=True),
                 P("template_id"),
             ]),
    Endpoint("broadcasts_delete", "POST", "/api/broadcasts.delete", "Delete a broadcast.",
             tag="broadcasts", body=[WID, P("id", required=True)]),
    Endpoint("broadcasts_get_test_results", "GET", "/api/broadcasts.getTestResults",
             "Get A/B test results for a broadcast.", tag="broadcasts",
             query=[WID, P("id", required=True)]),
    Endpoint("broadcasts_select_winner", "POST", "/api/broadcasts.selectWinner",
             "Select the winning A/B variation for a broadcast.", tag="broadcasts", body=[
                 WID, P("id", required=True), P("template_id", required=True, desc="Winning variation template ID."),
             ]),
    Endpoint("broadcasts_refresh_global_feed", "POST", "/api/broadcasts.refreshGlobalFeed",
             "Refresh the global data feed used by a broadcast.", tag="broadcasts",
             body=[WID, P("id", required=True)]),
    Endpoint("broadcasts_test_recipient_feed", "POST", "/api/broadcasts.testRecipientFeed",
             "Test the per-recipient data feed for a broadcast.", tag="broadcasts", body=[
                 WID, P("id", required=True), P("recipient_email"),
             ]),

    # ----- Transactional ---------------------------------------------------
    Endpoint("transactional_list", "GET", "/api/transactional.list",
             "List transactional notifications.", tag="transactional", query=[WID]),
    Endpoint("transactional_get", "GET", "/api/transactional.get",
             "Get a transactional notification.", tag="transactional",
             query=[WID, P("id", required=True)]),
    Endpoint("transactional_create", "POST", "/api/transactional.create",
             "Create a transactional notification definition.", tag="transactional", body=[
                 WID,
                 P("notification", "object", required=True,
                   desc="TransactionalNotification {id, name, channels:{email:{template_id,...}}, ...}."),
             ]),
    Endpoint("transactional_update", "POST", "/api/transactional.update",
             "Update a transactional notification definition.", tag="transactional", body=[
                 WID, P("id", required=True),
                 P("notification", "object", required=True),
             ]),
    Endpoint("transactional_delete", "POST", "/api/transactional.delete",
             "Delete a transactional notification definition.", tag="transactional",
             body=[WID, P("id", required=True)]),
    Endpoint("transactional_send", "POST", "/api/transactional.send",
             "Send a transactional notification to a contact.", tag="transactional", body=[
                 WID,
                 P("notification", "object", required=True,
                   desc="{id: <notification_id>, contact: {email,...}, data: {<template vars>}, "
                        "channels?: [...], metadata?: {...}}."),
             ]),
    Endpoint("transactional_test_template", "POST", "/api/transactional.testTemplate",
             "Send a test render of a transactional template.", tag="transactional", body=[
                 WID, P("template_id", required=True),
                 P("recipient_email", required=True), P("data", "object"),
             ]),

    # ----- Custom events ---------------------------------------------------
    Endpoint("custom_events_upsert", "POST", "/api/customEvents.upsert",
             "Create or update a custom event for a contact (with optional goal tracking).",
             tag="custom_events", body=[
                 WID, P("email", required=True), P("event_name", required=True),
                 P("external_id", required=True, desc="Unique external resource ID for the event."),
                 P("properties", "object"), P("occurred_at", desc="RFC3339 timestamp (defaults to now)."),
                 P("integration_id"),
                 P("goal_name"), P("goal_type", enum=["purchase", "subscription", "lead", "signup", "booking", "trial", "other"]),
                 P("goal_value", "number"),
             ]),
    Endpoint("custom_events_import", "POST", "/api/customEvents.import",
             "Batch import custom events.", tag="custom_events", body=[
                 WID, P("events", "array", item_type="object", required=True,
                        desc="Array of CustomEvent objects."),
             ]),
    Endpoint("custom_events_get", "GET", "/api/customEvents.get",
             "Get a custom event.", tag="custom_events",
             query=[WID, P("email", required=True), P("event_name"), P("external_id")]),
    Endpoint("custom_events_list", "GET", "/api/customEvents.list",
             "List custom events for a contact.", tag="custom_events",
             query=[WID, P("email", required=True), P("event_name"),
                    P("limit", "integer"), P("offset", "integer")]),

    # ----- Automations -----------------------------------------------------
    Endpoint("automations_create", "POST", "/api/automations.create",
             "Create an automation flow.", tag="automations", body=[
                 WID, P("automation", "object", required=True,
                        desc="Automation definition {id, name, trigger, nodes, edges, status, ...}."),
             ]),
    Endpoint("automations_get", "GET", "/api/automations.get",
             "Get an automation by ID.", tag="automations",
             query=[WID, P("automation_id", required=True)]),
    Endpoint("automations_list", "GET", "/api/automations.list",
             "List automations.", tag="automations", query=[
                 WID, P("status", "array", desc="Filter by statuses."),
                 P("list_id"), P("limit", "integer"), P("offset", "integer"),
             ]),
    Endpoint("automations_update", "POST", "/api/automations.update",
             "Update an automation flow.", tag="automations", body=[
                 WID, P("automation", "object", required=True),
             ]),
    Endpoint("automations_delete", "POST", "/api/automations.delete",
             "Delete an automation.", tag="automations",
             body=[WID, P("automation_id", required=True)]),
    Endpoint("automations_activate", "POST", "/api/automations.activate",
             "Activate an automation.", tag="automations",
             body=[WID, P("automation_id", required=True)]),
    Endpoint("automations_pause", "POST", "/api/automations.pause",
             "Pause an automation.", tag="automations",
             body=[WID, P("automation_id", required=True)]),
    Endpoint("automations_node_executions", "GET", "/api/automations.nodeExecutions",
             "Inspect node execution history for a contact in an automation (debug).",
             tag="automations",
             query=[WID, P("automation_id", required=True), P("email", required=True)]),

    # ----- Messages / history ---------------------------------------------
    Endpoint("messages_list", "GET", "/api/messages.list",
             "List message history with rich filters and cursor pagination.", tag="messages", query=[
                 WID, P("cursor"), P("limit", "integer"),
                 P("id"), P("external_id"), P("list_id"),
                 P("channel", desc="email|sms|push|..."),
                 P("contact_email"), P("broadcast_id"), P("template_id"),
                 P("is_sent", "boolean"), P("is_delivered", "boolean"),
                 P("is_failed", "boolean"), P("is_opened", "boolean"),
                 P("is_clicked", "boolean"), P("is_bounced", "boolean"),
                 P("is_complained", "boolean"), P("is_unsubscribed", "boolean"),
                 P("sent_after"), P("sent_before"),
                 P("updated_after"), P("updated_before"),
             ]),
    Endpoint("messages_broadcast_stats", "GET", "/api/messages.broadcastStats",
             "Get aggregate message statistics for a broadcast.", tag="messages",
             query=[WID, P("broadcast_id", required=True)]),

    # ----- Contact timeline ------------------------------------------------
    Endpoint("timeline_list", "GET", "/api/timeline.list",
             "List a contact's activity timeline.", tag="timeline",
             query=[WID, P("email", required=True), P("limit", "integer"), P("cursor")]),

    # ----- Analytics -------------------------------------------------------
    Endpoint("analytics_query", "POST", "/api/analytics.query",
             "Run an analytics query against workspace data.", tag="analytics", body=[
                 WID, P("query", "object", required=True,
                        desc="analytics.Query {schema, measures, dimensions, filters, "
                             "time_dimensions, order, limit, offset, timezone}."),
             ]),
    Endpoint("analytics_schemas", "POST", "/api/analytics.schemas",
             "Get the available analytics schemas (measures/dimensions).", tag="analytics",
             body=[WID]),

    # ----- Webhook subscriptions (outbound) --------------------------------
    Endpoint("webhook_subscriptions_create", "POST", "/api/webhookSubscriptions.create",
             "Create an outbound webhook subscription.", tag="webhook_subscriptions", body=[
                 WID, P("name", required=True), P("url", required=True),
                 P("event_types", "array", required=True, desc="Event types to subscribe to."),
                 P("enabled", "boolean"), P("metadata", "object"),
             ]),
    Endpoint("webhook_subscriptions_list", "GET", "/api/webhookSubscriptions.list",
             "List outbound webhook subscriptions.", tag="webhook_subscriptions", query=[WID]),
    Endpoint("webhook_subscriptions_get", "GET", "/api/webhookSubscriptions.get",
             "Get an outbound webhook subscription.", tag="webhook_subscriptions",
             query=[WID, P("id", required=True)]),
    Endpoint("webhook_subscriptions_update", "POST", "/api/webhookSubscriptions.update",
             "Update an outbound webhook subscription.", tag="webhook_subscriptions", body=[
                 WID, P("id", required=True), P("name"), P("url"),
                 P("event_types", "array"), P("enabled", "boolean"), P("metadata", "object"),
             ]),
    Endpoint("webhook_subscriptions_delete", "POST", "/api/webhookSubscriptions.delete",
             "Delete an outbound webhook subscription.", tag="webhook_subscriptions",
             body=[WID, P("id", required=True)]),
    Endpoint("webhook_subscriptions_toggle", "POST", "/api/webhookSubscriptions.toggle",
             "Enable/disable an outbound webhook subscription.", tag="webhook_subscriptions",
             body=[WID, P("id", required=True), P("enabled", "boolean", required=True)]),
    Endpoint("webhook_subscriptions_regenerate_secret", "POST", "/api/webhookSubscriptions.regenerateSecret",
             "Regenerate the signing secret for a webhook subscription.", tag="webhook_subscriptions",
             body=[WID, P("id", required=True)]),
    Endpoint("webhook_subscriptions_deliveries", "GET", "/api/webhookSubscriptions.deliveries",
             "List delivery attempts for a webhook subscription.", tag="webhook_subscriptions",
             query=[WID, P("id", required=True), P("limit", "integer"), P("offset", "integer")]),
    Endpoint("webhook_subscriptions_test", "POST", "/api/webhookSubscriptions.test",
             "Send a test event to a webhook subscription.", tag="webhook_subscriptions",
             body=[WID, P("id", required=True), P("event_type")]),
    Endpoint("webhook_subscriptions_event_types", "GET", "/api/webhookSubscriptions.eventTypes",
             "List available webhook event types.", tag="webhook_subscriptions", query=[WID]),

    # ----- Webhook registration (email providers) --------------------------
    Endpoint("webhooks_register", "POST", "/api/webhooks.register",
             "Register email event webhooks with the provider (SES, Mailgun, etc.).",
             tag="webhooks", body=[
                 WID, P("integration_id", required=True),
                 P("event_types", "array", required=True,
                   desc="Email event types (delivered, bounce, complaint, open, click, ...)."),
             ]),
    Endpoint("webhooks_status", "GET", "/api/webhooks.status",
             "Get the webhook registration status for an integration.", tag="webhooks",
             query=[WID, P("integration_id", required=True)]),

    # ----- Inbound webhook events ------------------------------------------
    Endpoint("inbound_webhook_events_list", "GET", "/api/inboundWebhookEvents.list",
             "List stored inbound webhook events.", tag="webhooks",
             query=[WID, P("limit", "integer"), P("offset", "integer")]),

    # ----- Email -----------------------------------------------------------
    Endpoint("email_test_provider", "POST", "/api/email.testProvider",
             "Send a test email through a workspace email provider.", tag="email", body=[
                 WID, P("to", required=True),
                 P("provider", "object", required=True, desc="EmailProvider config to test."),
             ]),

    # ----- Email tracking (no auth; records event then redirects/returns pixel) -----
    Endpoint("email_visit", "GET", "/visit",
             "Click-tracking redirect: records a click for a message then redirects to the "
             "target URL (returns the redirect target, does not follow it).",
             auth=False, tag="tracking", query=[
                 P("mid", required=True, desc="Message ID."),
                 P("wid", required=True, desc="Workspace ID."),
                 P("url", required=True, desc="Destination URL to redirect to."),
                 P("ts", desc="Client timestamp (ms) used to ignore <7s bot clicks."),
             ]),
    Endpoint("email_opens", "GET", "/opens",
             "Open-tracking pixel: records an open for a message and returns a 1x1 image.",
             auth=False, tag="tracking", query=[
                 P("mid", required=True, desc="Message ID."),
                 P("wid", required=True, desc="Workspace ID."),
                 P("ts", desc="Client timestamp (ms) used to ignore <7s bot opens."),
             ]),

    # ----- Blog: categories (workspace_id is a QUERY param) ----------------
    Endpoint("blog_categories_list", "GET", "/api/blogCategories.list",
             "List blog categories.", tag="blog", query=[WID]),
    Endpoint("blog_categories_get", "GET", "/api/blogCategories.get",
             "Get a blog category by ID or slug.", tag="blog",
             query=[WID, P("id"), P("slug")]),
    Endpoint("blog_categories_create", "POST", "/api/blogCategories.create",
             "Create a blog category.", tag="blog", query=[WID], body=[
                 P("name", required=True), P("slug", required=True),
                 P("description"), P("seo", "object"),
             ]),
    Endpoint("blog_categories_update", "POST", "/api/blogCategories.update",
             "Update a blog category.", tag="blog", query=[WID], body=[
                 P("id", required=True), P("name", required=True), P("slug", required=True),
                 P("description"), P("seo", "object"),
             ]),
    Endpoint("blog_categories_delete", "POST", "/api/blogCategories.delete",
             "Delete a blog category.", tag="blog", query=[WID], body=[P("id", required=True)]),

    # ----- Blog: posts -----------------------------------------------------
    Endpoint("blog_posts_list", "GET", "/api/blogPosts.list",
             "List blog posts.", tag="blog",
             query=[WID, P("category_id"), P("status"), P("page", "integer"), P("limit", "integer")]),
    Endpoint("blog_posts_get", "GET", "/api/blogPosts.get",
             "Get a blog post by ID or slug.", tag="blog",
             query=[WID, P("id"), P("slug"), P("category_slug")]),
    Endpoint("blog_posts_create", "POST", "/api/blogPosts.create",
             "Create a blog post.", tag="blog", query=[WID], body=[
                 P("category_id", required=True), P("slug", required=True),
                 P("title", required=True), P("template_id", required=True),
                 P("template_version", "integer"), P("excerpt"),
                 P("featured_image_url"), P("authors", "array", item_type="object"),
                 P("reading_time_minutes", "integer"), P("seo", "object"),
             ]),
    Endpoint("blog_posts_update", "POST", "/api/blogPosts.update",
             "Update a blog post.", tag="blog", query=[WID], body=[
                 P("id", required=True), P("category_id", required=True),
                 P("slug", required=True), P("title", required=True),
                 P("template_id", required=True), P("template_version", "integer"),
                 P("excerpt"), P("featured_image_url"),
                 P("authors", "array", item_type="object"),
                 P("reading_time_minutes", "integer"), P("seo", "object"),
             ]),
    Endpoint("blog_posts_delete", "POST", "/api/blogPosts.delete",
             "Delete a blog post.", tag="blog", query=[WID], body=[P("id", required=True)]),
    Endpoint("blog_posts_publish", "POST", "/api/blogPosts.publish",
             "Publish a blog post.", tag="blog", query=[WID], body=[
                 P("id", required=True), P("published_at", desc="Optional RFC3339 timestamp."),
                 P("timezone"),
             ]),
    Endpoint("blog_posts_unpublish", "POST", "/api/blogPosts.unpublish",
             "Unpublish a blog post.", tag="blog", query=[WID], body=[P("id", required=True)]),

    # ----- Blog: themes ----------------------------------------------------
    Endpoint("blog_themes_list", "GET", "/api/blogThemes.list",
             "List blog theme versions.", tag="blog",
             query=[WID, P("limit", "integer"), P("offset", "integer")]),
    Endpoint("blog_themes_get", "GET", "/api/blogThemes.get",
             "Get a blog theme version.", tag="blog", query=[WID, P("version", "integer", required=True)]),
    Endpoint("blog_themes_get_published", "GET", "/api/blogThemes.getPublished",
             "Get the currently published blog theme.", tag="blog", query=[WID]),
    Endpoint("blog_themes_create", "POST", "/api/blogThemes.create",
             "Create a blog theme version.", tag="blog", query=[WID], body=[
                 P("files", "object", required=True, desc="BlogThemeFiles (template files)."),
                 P("notes"),
             ]),
    Endpoint("blog_themes_update", "POST", "/api/blogThemes.update",
             "Update a blog theme version.", tag="blog", query=[WID], body=[
                 P("version", "integer", required=True),
                 P("files", "object", required=True), P("notes"),
             ]),
    Endpoint("blog_themes_publish", "POST", "/api/blogThemes.publish",
             "Publish a blog theme version.", tag="blog", query=[WID],
             body=[P("version", "integer", required=True)]),

    # ----- Tasks / cron ----------------------------------------------------
    Endpoint("tasks_create", "POST", "/api/tasks.create", "Create a background task.", tag="tasks", body=[
        WID, P("type", required=True), P("state", "object"),
        P("max_runtime", "integer"), P("max_retries", "integer"),
        P("retry_interval", "integer"), P("next_run_after", desc="RFC3339 timestamp."),
        P("recurring_interval", "integer", desc="Seconds between runs (omit for one-shot)."),
        P("integration_id"),
    ]),
    Endpoint("tasks_list", "GET", "/api/tasks.list", "List background tasks.", tag="tasks", query=[
        WID, P("status", "array"), P("type", "array"),
        P("created_after"), P("created_before"),
        P("limit", "integer"), P("offset", "integer"),
    ]),
    Endpoint("tasks_get", "GET", "/api/tasks.get", "Get a background task.", tag="tasks",
             query=[WID, P("id", required=True)]),
    Endpoint("tasks_delete", "POST", "/api/tasks.delete", "Delete a background task.", tag="tasks",
             body=[WID, P("id", required=True)]),
    Endpoint("tasks_reset", "POST", "/api/tasks.reset", "Reset a background task.", tag="tasks",
             body=[WID, P("id", required=True)]),
    Endpoint("tasks_trigger", "POST", "/api/tasks.trigger", "Trigger a background task to run.",
             tag="tasks", body=[WID, P("id", required=True)]),
    Endpoint("tasks_execute", "POST", "/api/tasks.execute",
             "Execute a single task immediately (public; for external schedulers).",
             auth=False, tag="tasks", body=[WID, P("id", required=True)]),
    Endpoint("cron", "GET", "/api/cron",
             "Run all pending tasks (cron ping; public).", auth=False, tag="tasks",
             query=[P("max_tasks", "integer")]),
    Endpoint("cron_status", "GET", "/api/cron.status",
             "Get the last cron run status (public).", auth=False, tag="tasks"),

    # ----- LLM -------------------------------------------------------------
    Endpoint("llm_chat", "POST", "/api/llm.chat",
             "Chat with the workspace's configured LLM provider (returns a streamed/SSE "
             "response which this tool collects).", tag="llm", body=[
                 WID, P("integration_id", required=True),
                 P("messages", "array", item_type="object", required=True,
                   desc="Array of {role, content} chat messages."),
                 P("max_tokens", "integer"), P("system_prompt"),
                 P("tools", "array", item_type="object"),
             ]),

    # ----- Public notification center / misc -------------------------------
    Endpoint("subscribe", "POST", "/subscribe",
             "Public list subscription (no auth; double opt-in aware).", auth=False, tag="public", body=[
                 WID, P("contact", "object", required=True, desc="Contact object (must include 'email')."),
                 P("list_ids", "array", required=True),
             ]),
    Endpoint("unsubscribe_oneclick", "POST", "/unsubscribe-oneclick",
             "Gmail one-click unsubscribe (no auth).", auth=False, tag="public", body=[
                 P("wid", required=True, desc="Workspace ID."),
                 P("email", required=True), P("email_hmac", required=True),
                 P("lids", "array", desc="List IDs."), P("mid", desc="Message ID."),
             ]),
    Endpoint("preferences_get", "GET", "/preferences",
             "Get a contact's notification preferences (requires email + email_hmac).",
             auth=False, tag="public",
             query=[P("wid", required=True), P("email", required=True), P("email_hmac", required=True)]),
    Endpoint("preferences_update", "POST", "/preferences",
             "Update a contact's notification preferences (requires email + email_hmac).",
             auth=False, tag="public", body=[
                 P("wid", required=True), P("email", required=True), P("email_hmac", required=True),
                 P("list_ids", "array"),
             ]),
    Endpoint("detect_favicon", "POST", "/api/detect-favicon",
             "Detect favicon/cover image from a URL.", auth=False, tag="public",
             body=[P("url", required=True)]),
    Endpoint("health", "GET", "/health",
             "Health check with DB connection pool stats (no auth).", auth=False, tag="system"),
    Endpoint("healthz", "GET", "/healthz", "Liveness probe (no auth).", auth=False, tag="system"),

    # ----- Demo (non-production instances only) ----------------------------
    Endpoint("demo_reset", "GET", "/api/demo.reset",
             "Reset demo data (HMAC-gated; only registered on non-production instances, "
             "5-minute rate limit). Returns 404 on production.", auth=False, tag="demo",
             query=[P("hmac", required=True, desc="Root-email HMAC authorizing the reset.")]),
]


ENDPOINTS_BY_NAME: dict[str, Endpoint] = {e.name: e for e in ENDPOINTS}
