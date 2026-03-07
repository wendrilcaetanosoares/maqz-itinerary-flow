

## Plan: Add machine photo support to tasks

### Database Migration

Execute the SQL provided by the user as a single migration:

1. Add `machine_photo_url` text column to `tasks` table
2. Create `machine-photos` storage bucket (public)
3. Create RLS policies for storage: authenticated upload, public read, owner/admin delete

### Code Changes

1. **`src/components/TaskFormDialog.tsx`** — Add image upload field with preview. In edit mode, show existing photo. Upload to `machine-photos` bucket on save, store URL in `machine_photo_url`.

2. **`src/pages/Tasks.tsx`** — Show machine photo thumbnail on task cards when `machine_photo_url` exists.

3. **`src/components/TaskActionButtons.tsx`** — Add "Editar" button visible only when `canManageTasks` is true. Clicking opens `TaskFormDialog` in edit mode with the task data pre-filled.

4. **`src/pages/Dashboard.tsx`** — Show machine photo in history cards if available.

### Edit Mode for TaskFormDialog

- Accept optional `task` prop (existing task to edit)
- Pre-fill all fields: client name, phone, address, CEP, machine, observations, scheduled date/time, deadline, type, priority, sector, assignees, value, and machine photo
- On submit: `update` instead of `insert` when editing
- Upload new photo to `machine-photos/{userId}/{timestamp}`, delete old photo if replaced

### Role-Based Edit Button

- Only users with `admin` or `task_applier` roles see the "Editar" button (use existing `canManageTasks` from AuthContext)
- Regular employees see no edit option

