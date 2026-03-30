import { supabase } from '../lib/supabase'

// ─── Mapping helpers ───────────────────────────────────────────────

function mapProcess(row) {
  if (!row) return null
  return {
    id: row.id,
    processName: row.process_name,
    processNames: row.process_names || [],
    org: row.org,
    function: row.function || [],
    level: row.level,
    subProcesses: row.sub_processes || [],
    version: row.version,
    bpmnXml: row.bpmn_xml,
    fileName: row.file_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toDbProcess(form) {
  return {
    id: form.id,
    process_name: form.processName,
    process_names: form.processNames || [],
    org: form.org,
    function: Array.isArray(form.function) ? form.function : (form.function ? [form.function] : []),
    level: form.level,
    sub_processes: form.subProcesses || [],
    version: form.version || '1.0',
    bpmn_xml: form.bpmnXml || '',
    file_name: form.fileName || '',
  }
}

function mapVersion(row) {
  if (!row) return null
  return {
    id: row.id,
    processId: row.process_id,
    version: row.version,
    bpmnXml: row.bpmn_xml,
    fileName: row.file_name,
    changeNotes: row.change_notes,
    archivedAt: row.archived_at,
  }
}

// ─── Processes ─────────────────────────────────────────────────────

export async function getProcesses() {
  const { data, error } = await supabase
    .from('processes')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data || []).map(mapProcess)
}

export async function getProcess(id) {
  const { data, error } = await supabase
    .from('processes')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return mapProcess(data)
}

export async function createProcess(form) {
  const { data, error } = await supabase
    .from('processes')
    .insert([toDbProcess(form)])
    .select()
    .single()
  if (error) throw error
  return mapProcess(data)
}

export async function updateProcess(id, form) {
  const { data, error } = await supabase
    .from('processes')
    .update({ ...toDbProcess(form), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return mapProcess(data)
}

export async function deleteProcess(id) {
  const { error } = await supabase.from('processes').delete().eq('id', id)
  if (error) throw error
}

// ─── BPMN versioning ───────────────────────────────────────────────

export async function updateBpmn(id, { bpmnXml, fileName, changeNotes }) {
  const current = await getProcess(id)

  // Archive current diagram as a previous version
  if (current.bpmnXml) {
    await supabase.from('process_versions').insert([{
      process_id: id,
      version: current.version,
      bpmn_xml: current.bpmnXml,
      file_name: current.fileName,
      change_notes: changeNotes || null,
      archived_at: new Date().toISOString(),
    }])
  }

  // Bump version: 1.0 → 1.1, 1.9 → 2.0, etc.
  const old = parseFloat(current.version || '1.0')
  const next = (Math.round((old + 0.1) * 10) / 10).toFixed(1)

  return updateProcess(id, {
    ...current,
    bpmnXml,
    fileName: fileName || current.fileName,
    version: next,
  })
}

export async function getProcessVersions(id) {
  const { data, error } = await supabase
    .from('process_versions')
    .select('*')
    .eq('process_id', id)
    .order('archived_at', { ascending: false })
  if (error) throw error
  return (data || []).map(mapVersion)
}

// ─── ID generation ─────────────────────────────────────────────────

export function generateId(functionName, existingProcesses) {
  const prefix = functionName
    ? functionName.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 3)
    : 'PRC'
  const pattern = new RegExp(`^${prefix}-(\\d+)$`)
  const nums = (existingProcesses || [])
    .map(p => { const m = p.id?.match(pattern); return m ? parseInt(m[1]) : 0 })
    .filter(n => n > 0)
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1
  return `${prefix}-${String(next).padStart(3, '0')}`
}

// ─── App Users (System Administrator manages) ──────────────────────

export async function signUpNewUser(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  return data
}

export async function getAppUsers() {
  const { data, error } = await supabase
    .from('app_users')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function createAppUser({ email, name, roles }) {
  const { data, error } = await supabase
    .from('app_users')
    .insert([{ email, name, roles }])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateAppUser(id, { name, roles, is_active }) {
  const { data, error } = await supabase
    .from('app_users')
    .update({ name, roles, is_active })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteAppUser(id) {
  const { error } = await supabase.from('app_users').delete().eq('id', id)
  if (error) throw error
}

// ─── Change Requests (approval workflow) ───────────────────────────

export async function createChangeRequest({ processId, requesterEmail, requestedBy, changeType, changeData, changeNotes }) {
  const { data, error } = await supabase
    .from('process_change_requests')
    .insert([{
      process_id:      processId || null,
      requested_by:    requestedBy,
      requester_email: requesterEmail,
      change_type:     changeType,
      change_data:     changeData,
      change_notes:    changeNotes || null,
      status:          'pending',
    }])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getPendingChangeRequests() {
  const { data, error } = await supabase
    .from('process_change_requests')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function getAllChangeRequests() {
  const { data, error } = await supabase
    .from('process_change_requests')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getMyChangeRequests(userId) {
  const { data, error } = await supabase
    .from('process_change_requests')
    .select('*')
    .eq('requested_by', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function approveChangeRequest(id, { reviewerEmail, reviewedBy, reviewNotes, changeType, processId, changeData }) {
  // Apply the change to the actual process table
  let saved = null
  if (changeType === 'create') {
    saved = await createProcess(changeData.form)
  } else if (changeType === 'update') {
    saved = await updateProcess(processId, changeData.form)
  } else if (changeType === 'bpmn') {
    saved = await updateBpmn(processId, changeData)
  }

  // Mark request as approved
  const { error } = await supabase
    .from('process_change_requests')
    .update({
      status:         'approved',
      reviewed_by:    reviewedBy,
      reviewer_email: reviewerEmail,
      review_notes:   reviewNotes || null,
      reviewed_at:    new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw error
  return saved
}

export async function rejectChangeRequest(id, { reviewerEmail, reviewedBy, reviewNotes }) {
  const { error } = await supabase
    .from('process_change_requests')
    .update({
      status:         'rejected',
      reviewed_by:    reviewedBy,
      reviewer_email: reviewerEmail,
      review_notes:   reviewNotes || null,
      reviewed_at:    new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw error
}

// ─── Organizations ─────────────────────────────────────────────────

export async function getOrgs() {
  const { data, error } = await supabase
    .from('org_functions')
    .select('org')
    .order('org')
  if (error) throw error
  return [...new Set((data || []).map(r => r.org))].sort()
}

export async function getOrgData(org) {
  const { data, error } = await supabase
    .from('org_functions')
    .select('*')
    .eq('org', org)
  if (error) throw error
  return (data || []).reduce((acc, row) => {
    acc[row.function_name] = {
      subProcesses: row.sub_processes || [],
      processNames: row.process_names || [],
    }
    return acc
  }, {})
}

export async function addOrgFunction(org, { functionName, subProcesses, processNames }) {
  const { error } = await supabase
    .from('org_functions')
    .upsert([{
      org,
      function_name: functionName,
      sub_processes: subProcesses || [],
      process_names: processNames || [],
    }], { onConflict: 'org,function_name' })
  if (error) throw error
}

export async function deleteOrgFunction(org, functionName) {
  const { error } = await supabase
    .from('org_functions')
    .delete()
    .eq('org', org)
    .eq('function_name', functionName)
  if (error) throw error
}

export async function deleteOrg(org) {
  const { error } = await supabase
    .from('org_functions')
    .delete()
    .eq('org', org)
  if (error) throw error
}

// ─── Flask AI API ───────────────────────────────────────────────────

const FLASK_BASE = import.meta.env.VITE_FLASK_API_URL || 'http://localhost:5000'

async function flaskPost(path, body) {
  const res = await fetch(`${FLASK_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Flask API error ${res.status}`)
  }
  return res.json()
}

export async function extractDocument(file) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${FLASK_BASE}/extract-document`, {
    method: 'POST',
    body: formData,
    // no Content-Type header — browser sets it with boundary automatically
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Flask API error ${res.status}`)
  }
  return res.json()
}

export async function aiGenerateBpmn({ description, appName, appIndustry, appPurpose, documentContext = '', existingBpmnXml = '' }) {
  return flaskPost('/generate', {
    description,
    app_name: appName,
    app_industry: appIndustry,
    app_purpose: appPurpose,
    document_context: existingBpmnXml ? '' : documentContext,
    existing_bpmn_xml: existingBpmnXml || '',
  })
}

export async function aiGenerateTests(sessionId) {
  return flaskPost('/generate-tests', { session_id: sessionId })
}

export async function aiGenerateSpringBootPrompt(sessionId) {
  return flaskPost('/generate-springboot-prompt', { session_id: sessionId })
}

export async function aiGenerateReactPrompt(sessionId) {
  return flaskPost('/generate-react-prompt', { session_id: sessionId })
}
