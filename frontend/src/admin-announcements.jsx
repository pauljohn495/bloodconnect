import React, { useEffect, useState } from 'react'
import AdminLayout from './AdminLayout.jsx'
import { apiRequest } from './api.js'
import { adminPanel } from './admin-ui.jsx'

const TYPE_OPTIONS = [
  { value: 'blood_drive', label: 'Blood Drive' },
  { value: 'urgent_need', label: 'Urgent Need' },
  { value: 'general', label: 'General' },
]

const STATUS_OPTIONS = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'completed', label: 'Completed' },
]

const POST_CATEGORY_OPTIONS = [
  { value: 'top_donors', label: 'Top 10 Donors' },
  { value: 'top_organizers', label: 'Top 10 Organizers' },
  { value: 'top_municipality', label: 'Top Municipality' },
]

function typeLabel(type) {
  const t = TYPE_OPTIONS.find((o) => o.value === type)
  return t ? t.label : type
}

function statusLabel(status) {
  const s = STATUS_OPTIONS.find((o) => o.value === status)
  return s ? s.label : status
}

function postCategoryLabel(category) {
  const c = POST_CATEGORY_OPTIONS.find((o) => o.value === category)
  return c ? c.label : category
}

function toDatetimeLocalValue(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatEventDisplay(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function TypeIcon({ type, className = 'h-4 w-4' }) {
  if (type === 'blood_drive') {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    )
  }
  if (type === 'urgent_need') {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
    )
  }
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  )
}

function typeBadgeClasses(type) {
  if (type === 'urgent_need') return 'bg-red-100 text-red-800 ring-red-200'
  if (type === 'blood_drive') return 'bg-rose-100 text-rose-800 ring-rose-200'
  return 'bg-slate-100 text-slate-700 ring-slate-200'
}

function statusBadgeClasses(status) {
  if (status === 'ongoing') return 'bg-emerald-100 text-emerald-800 ring-emerald-200'
  if (status === 'completed') return 'bg-slate-100 text-slate-600 ring-slate-200'
  return 'bg-sky-100 text-sky-800 ring-sky-200'
}

const emptyForm = () => ({
  title: '',
  description: '',
  announcementType: 'general',
  eventStartsAt: '',
  location: '',
  status: 'upcoming',
})

const emptyPostForm = () => ({
  title: '',
  body: '',
  isPublished: true,
})

function AdminAnnouncements() {
  const [items, setItems] = useState([])
  const [posts, setPosts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [postError, setPostError] = useState('')
  const [notification, setNotification] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [postForm, setPostForm] = useState(emptyPostForm)
  const [editingPost, setEditingPost] = useState(null)
  const [savingPost, setSavingPost] = useState(false)
  const [postModalOpen, setPostModalOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('mbd')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    try {
      setIsLoading(true)
      setError('')
      const data = await apiRequest('/api/admin/announcements')
      setItems(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message || 'Failed to load announcements')
    } finally {
      setIsLoading(false)
    }
  }

  const loadPosts = async () => {
    try {
      setPostError('')
      const data = await apiRequest('/api/admin/home-posts')
      setPosts(Array.isArray(data) ? data : [])
    } catch (err) {
      setPostError(err.message || 'Failed to load posts')
      setPosts([])
    }
  }

  useEffect(() => {
    load()
    loadPosts()
  }, [])

  const showNotification = (message, type = 'primary') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 5000)
  }

  const openCreate = () => {
    setEditing(null)
    const next = emptyForm()
    const now = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    next.eventStartsAt = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
    setForm(next)
    setModalOpen(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    setForm({
      title: row.title || '',
      description: row.description || '',
      announcementType: row.announcement_type || 'general',
      eventStartsAt: toDatetimeLocalValue(row.event_starts_at),
      location: row.location || '',
      status: row.status || 'upcoming',
    })
    setModalOpen(true)
  }

  const closeModal = () => {
    if (saving) return
    setModalOpen(false)
    setEditing(null)
    setForm(emptyForm())
  }

  const normalizeEventPayload = (local) => {
    if (!local) return null
    return local.replace('T', ' ').length === 16 ? `${local.replace('T', ' ')}:00` : local.replace('T', ' ')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const eventStartsAt = normalizeEventPayload(form.eventStartsAt)
    if (!eventStartsAt) {
      showNotification('Please set date and time', 'destructive')
      return
    }
    setSaving(true)
    try {
      const body = {
        title: form.title.trim(),
        description: form.description,
        announcementType: form.announcementType,
        eventStartsAt,
        location: form.location,
        status: form.status,
      }
      if (editing) {
        await apiRequest(`/api/admin/announcements/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
        showNotification('Announcement updated successfully!', 'primary')
      } else {
        await apiRequest('/api/admin/announcements', {
          method: 'POST',
          body: JSON.stringify(body),
        })
        showNotification('Announcement created successfully!', 'primary')
      }
      setModalOpen(false)
      setEditing(null)
      setForm(emptyForm())
      await load()
    } catch (err) {
      showNotification(err.message || 'Save failed', 'destructive')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await apiRequest(`/api/admin/announcements/${deleteTarget.id}`, { method: 'DELETE' })
      showNotification('Announcement deleted successfully!', 'primary')
      setDeleteTarget(null)
      await load()
    } catch (err) {
      showNotification(err.message || 'Delete failed', 'destructive')
    } finally {
      setDeleting(false)
    }
  }

  const resetPostForm = () => {
    setEditingPost(null)
    setPostForm(emptyPostForm())
  }

  const openCreatePost = () => {
    resetPostForm()
    setPostModalOpen(true)
  }

  const closePostModal = () => {
    if (savingPost) return
    setPostModalOpen(false)
    resetPostForm()
  }

  const submitPost = async (e) => {
    e.preventDefault()
    if (!postForm.title.trim() || !postForm.body.trim()) {
      showNotification('Please add title and content for post', 'destructive')
      return
    }
    setSavingPost(true)
    try {
      const payload = {
        title: postForm.title.trim(),
        body: postForm.body,
        isPublished: postForm.isPublished,
      }
      if (editingPost) {
        await apiRequest(`/api/admin/home-posts/${editingPost.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
        showNotification('Post updated successfully!', 'primary')
      } else {
        await apiRequest('/api/admin/home-posts', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        showNotification('Post created successfully!', 'primary')
      }
      setPostModalOpen(false)
      resetPostForm()
      await loadPosts()
    } catch (err) {
      showNotification(err.message || 'Failed to save post', 'destructive')
    } finally {
      setSavingPost(false)
    }
  }

  const openEditPost = (post) => {
    setEditingPost(post)
    setPostForm({
      title: post.title || '',
      body: post.body || '',
      isPublished: !!post.is_published,
    })
    setPostModalOpen(true)
  }

  const removePost = async (post) => {
    try {
      await apiRequest(`/api/admin/home-posts/${post.id}`, { method: 'DELETE' })
      showNotification('Post deleted successfully!', 'primary')
      if (editingPost?.id === post.id) resetPostForm()
      await loadPosts()
    } catch (err) {
      showNotification(err.message || 'Failed to delete post', 'destructive')
    }
  }

  const mapsUrl = (loc) =>
    loc ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc)}` : null

  const mbdItems = items

  return (
    <AdminLayout
      pageTitle="Announcements"
      pageDescription="Post and manage blood drives, urgent needs, and general updates."
    >
      <React.Fragment>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Announcements</h2>
          </div>
          {activeSection === 'mbd' && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 sm:w-auto"
            >
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add MBD
            </button>
          )}
        </div>

        <div className="flex items-center justify-start">
          <div
            className="inline-flex items-center gap-0.5 rounded-lg bg-slate-100/95 p-1 ring-1 ring-slate-200/70"
            role="tablist"
            aria-label="Announcements section"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeSection === 'mbd'}
              onClick={() => setActiveSection('mbd')}
              className={`rounded-md px-3.5 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 ${
                activeSection === 'mbd'
                  ? 'border border-slate-200/90 bg-white text-red-900 shadow-sm shadow-slate-200/80'
                  : 'border border-transparent bg-transparent text-slate-600 hover:text-slate-800'
              }`}
            >
              MBD
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeSection === 'post'}
              onClick={() => setActiveSection('post')}
              className={`rounded-md px-3.5 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 ${
                activeSection === 'post'
                  ? 'border border-slate-200/90 bg-white text-red-900 shadow-sm shadow-slate-200/80'
                  : 'border border-transparent bg-transparent text-slate-600 hover:text-slate-800'
              }`}
            >
              Post
            </button>
          </div>
        </div>

        {activeSection === 'mbd' && isLoading && (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500 shadow-sm">
            Loading announcements…
          </div>
        )}

        {activeSection === 'mbd' && !isLoading && error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        )}

        {activeSection === 'mbd' && !isLoading && !error && items.length === 0 && (
          <div className={adminPanel.amber.outer}>
            <div className="px-4 py-14 text-center sm:px-6">
              <p className="text-sm font-medium text-slate-600">No announcements yet.</p>
              <p className="mt-1 text-sm text-slate-500">Create one to inform donors about drives and urgent needs.</p>
            </div>
          </div>
        )}

        {activeSection === 'mbd' && !isLoading && !error && items.length > 0 && (
          <div className="space-y-8">
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold tracking-tight text-slate-900">MBD</h3>
                <span className="text-xs font-medium text-slate-500">{mbdItems.length} item{mbdItems.length === 1 ? '' : 's'}</span>
              </div>
              {mbdItems.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-sm">
                  No MBD announcements yet.
                </div>
              ) : (
                <ul className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  {mbdItems.map((a) => {
                    const urgent = a.announcement_type === 'urgent_need'
                    return (
                      <li
                        key={a.id}
                        className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-100/90 transition hover:shadow-lg hover:ring-slate-200/90"
                      >
                        <div
                          className={`relative flex flex-1 flex-col px-5 pb-5 pt-5 ${
                            urgent ? 'bg-gradient-to-br from-red-50/50 via-white to-white' : 'bg-white'
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide shadow-sm ring-1 ${typeBadgeClasses(
                                    a.announcement_type,
                                  )}`}
                                >
                                  <TypeIcon type={a.announcement_type} className="h-3.5 w-3.5" />
                                  {typeLabel(a.announcement_type)}
                                </span>
                                <span
                                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ring-1 ${statusBadgeClasses(
                                    a.status,
                                  )}`}
                                >
                                  {statusLabel(a.status)}
                                </span>
                              </div>
                              <h3
                                className={`mt-3 text-lg font-bold leading-snug tracking-tight ${
                                  urgent ? 'text-red-950' : 'text-slate-900'
                                }`}
                              >
                                {a.title}
                              </h3>
                            </div>
                            <div className="flex shrink-0 gap-2">
                              <button
                                type="button"
                                onClick={() => openEdit(a)}
                                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(a)}
                                className="rounded-xl border border-red-200 bg-white px-3.5 py-2 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-50"
                              >
                                Delete
                              </button>
                            </div>
                          </div>

                          {a.description ? (
                            <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-slate-600">{a.description}</p>
                          ) : (
                            <p className="mt-3 text-sm italic text-slate-400">No description</p>
                          )}

                          <div className="mt-5 grid gap-3 border-t border-slate-100/90 pt-4 sm:grid-cols-2">
                            <div className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/90 p-3 ring-1 ring-slate-100/80">
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-red-600 shadow-sm ring-1 ring-slate-200/60">
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={1.75}
                                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                  />
                                </svg>
                              </span>
                              <div className="min-w-0">
                                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">When</p>
                                <p className="mt-0.5 text-sm font-semibold text-slate-900">{formatEventDisplay(a.event_starts_at)}</p>
                              </div>
                            </div>
                            <div className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/90 p-3 ring-1 ring-slate-100/80 sm:col-span-1">
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-red-600 shadow-sm ring-1 ring-slate-200/60">
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={1.75}
                                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                                  />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Where</p>
                                <p className="mt-0.5 text-sm font-semibold text-slate-900">
                                  {a.location ? (
                                    <a
                                      href={mapsUrl(a.location)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-red-700 underline decoration-red-200 underline-offset-2 transition hover:text-red-800"
                                    >
                                      {a.location}
                                    </a>
                                  ) : (
                                    <span className="font-medium text-slate-400">—</span>
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

          </div>
        )}

        {activeSection === 'post' && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold tracking-tight text-slate-900">Post</h3>
              <span className="text-xs font-medium text-slate-500">
                {posts.length} item{posts.length === 1 ? '' : 's'}
              </span>
            </div>

            {postError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{postError}</div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">Post Management</h4>
                  <p className="mt-1 text-xs text-slate-500">Create and publish homepage ranking posts from a modal form.</p>
                </div>
                <button
                  type="button"
                  onClick={openCreatePost}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                >
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Post
                </button>
              </div>
            </div>

            {posts.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-sm">
                No posts yet.
              </div>
            ) : (
              <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {posts.map((post) => (
                  <li key={post.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                        {postCategoryLabel(post.category)}
                      </span>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                          post.is_published ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {post.is_published ? 'Published' : 'Draft'}
                      </span>
                    </div>
                    <h4 className="mt-3 text-base font-semibold text-slate-900">{post.title}</h4>
                    <p className="mt-2 line-clamp-5 whitespace-pre-line text-sm text-slate-600">{post.body}</p>
                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => openEditPost(post)}
                        className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => removePost(post)}
                        className="rounded-xl border border-red-200 bg-white px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close dialog"
            onClick={closeModal}
          />
          <div
            className="relative z-10 flex max-h-[min(94vh,760px)] w-full max-w-lg flex-col overflow-hidden rounded-t-[1.25rem] bg-white shadow-2xl shadow-slate-900/20 ring-1 ring-slate-200/90 sm:max-h-[min(90vh,720px)] sm:rounded-3xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="announcement-modal-title"
          >
            <div className="flex justify-center pt-3 sm:hidden" aria-hidden="true">
              <span className="h-1 w-10 rounded-full bg-slate-200" />
            </div>
            <div className="relative overflow-hidden bg-gradient-to-br from-red-600 via-red-600 to-rose-800 px-5 pb-6 pt-4 sm:rounded-t-3xl sm:pt-5">
              <div className="pointer-events-none absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.06\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/svg%3E')] opacity-90" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-red-100">
                    {editing ? 'Update listing' : 'New announcement'}
                  </p>
                  <h3 id="announcement-modal-title" className="mt-1 text-xl font-bold tracking-tight text-white sm:text-2xl">
                    {editing ? 'Edit announcement' : 'Create announcement'}
                  </h3>
                  <p className="mt-1 max-w-sm text-sm text-red-100/95">
                    {editing ? 'Changes apply immediately for donors on the home page and dashboard.' : 'Visible to donors on the landing page and in the announcements panel.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="shrink-0 rounded-xl bg-white/15 p-2 text-white ring-1 ring-white/25 transition hover:bg-white/25 disabled:opacity-50"
                  disabled={saving}
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col bg-slate-50/40">
              <div className="space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm ring-1 ring-slate-100/80">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Content</p>
                  <div className="mt-3 space-y-4">
                    <div>
                      <label htmlFor="ann-title" className="block text-sm font-semibold text-slate-800">
                        Title <span className="font-normal text-red-600">*</span>
                      </label>
                      <input
                        id="ann-title"
                        required
                        value={form.title}
                        onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/25"
                        placeholder="e.g. City Hall Blood Drive"
                      />
                    </div>
                    <div>
                      <label htmlFor="ann-desc" className="block text-sm font-semibold text-slate-800">
                        Description
                      </label>
                      <textarea
                        id="ann-desc"
                        rows={4}
                        value={form.description}
                        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                        className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/25"
                        placeholder="What donors should know — schedule, who can donate, what to bring…"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm ring-1 ring-slate-100/80">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Classification</p>
                  <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="ann-type" className="block text-sm font-semibold text-slate-800">
                        Type
                      </label>
                      <select
                        id="ann-type"
                        value={form.announcementType}
                        onChange={(e) => setForm((f) => ({ ...f, announcementType: e.target.value }))}
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/25"
                      >
                        {TYPE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="ann-status" className="block text-sm font-semibold text-slate-800">
                        Status
                      </label>
                      <select
                        id="ann-status"
                        value={form.status}
                        onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/25"
                      >
                        {STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm ring-1 ring-slate-100/80">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Schedule &amp; place</p>
                  <div className="mt-3 space-y-4">
                    <div>
                      <label htmlFor="ann-when" className="block text-sm font-semibold text-slate-800">
                        Date &amp; time <span className="font-normal text-red-600">*</span>
                      </label>
                      <input
                        id="ann-when"
                        type="datetime-local"
                        required
                        value={form.eventStartsAt}
                        onChange={(e) => setForm((f) => ({ ...f, eventStartsAt: e.target.value }))}
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/25"
                      />
                    </div>
                    <div>
                      <label htmlFor="ann-loc" className="block text-sm font-semibold text-slate-800">
                        Location
                      </label>
                      <input
                        id="ann-loc"
                        value={form.location}
                        onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/25"
                        placeholder="Address or venue name"
                      />
                      <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-slate-500">
                        <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Donors get a button to open this address in Google Maps.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col-reverse gap-2 border-t border-slate-200/80 bg-white px-4 py-4 sm:flex-row sm:justify-end sm:gap-3 sm:px-6">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="min-h-11 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-11 rounded-2xl bg-red-600 px-5 text-sm font-semibold text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 disabled:opacity-60"
                >
                  {saving ? 'Saving…' : editing ? 'Save changes' : 'Publish announcement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {postModalOpen && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close post dialog"
            onClick={closePostModal}
          />
          <div
            className="relative z-10 flex max-h-[min(94vh,760px)] w-full max-w-lg flex-col overflow-hidden rounded-t-[1.25rem] bg-white shadow-2xl shadow-slate-900/20 ring-1 ring-slate-200/90 sm:max-h-[min(90vh,720px)] sm:rounded-3xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="post-modal-title"
          >
            <div className="relative overflow-hidden bg-gradient-to-br from-red-600 via-red-600 to-rose-800 px-5 pb-6 pt-4 sm:rounded-t-3xl sm:pt-5">
              <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-red-100">
                    {editingPost ? 'Update post' : 'New post'}
                  </p>
                  <h3 id="post-modal-title" className="mt-1 text-xl font-bold tracking-tight text-white sm:text-2xl">
                    {editingPost ? 'Edit post' : 'Create post'}
                  </h3>
                  <p className="mt-1 max-w-sm text-sm text-red-100/95">
                    Publish Top Donors, Organizers, or Municipality to show on home page.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closePostModal}
                  className="shrink-0 rounded-xl bg-white/15 p-2 text-white ring-1 ring-white/25 transition hover:bg-white/25 disabled:opacity-50"
                  disabled={savingPost}
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
              <form className="space-y-3 overflow-y-auto bg-slate-50/40 px-4 py-5 sm:px-6" onSubmit={submitPost}>
              <div>
                <label htmlFor="post-title" className="block text-xs font-semibold text-slate-700">
                  Title
                </label>
                <input
                  id="post-title"
                  value={postForm.title}
                  onChange={(e) => setPostForm((f) => ({ ...f, title: e.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/25"
                  placeholder="e.g. Top 10 Donors - April 2026"
                />
              </div>
              <div>
                <label htmlFor="post-body" className="block text-xs font-semibold text-slate-700">
                  Content
                </label>
                <textarea
                  id="post-body"
                  rows={8}
                  value={postForm.body}
                  onChange={(e) => setPostForm((f) => ({ ...f, body: e.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/25"
                  placeholder="1. Name - value&#10;2. Name - value&#10;..."
                />
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={postForm.isPublished}
                  onChange={(e) => setPostForm((f) => ({ ...f, isPublished: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                />
                Publish on home page
              </label>
              <div className="flex flex-col-reverse gap-2 border-t border-slate-200/80 bg-white px-0 py-4 sm:flex-row sm:justify-end sm:gap-3">
                <button
                  type="button"
                  onClick={closePostModal}
                  disabled={savingPost}
                  className="min-h-11 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPost}
                  className="min-h-11 rounded-2xl bg-red-600 px-5 text-sm font-semibold text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 disabled:opacity-60"
                >
                  {savingPost ? 'Saving…' : editingPost ? 'Save post' : 'Publish post'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]">
          <div
            className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-2xl shadow-slate-900/20 ring-1 ring-slate-100"
            role="alertdialog"
            aria-labelledby="delete-ann-title"
            aria-describedby="delete-ann-desc"
          >
            <div className="border-b border-red-100 bg-white px-6 pb-5 pt-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-700 ring-2 ring-red-200/60">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.75}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </div>
              <h4 id="delete-ann-title" className="mt-4 text-lg font-bold text-slate-900">
                Delete this announcement?
              </h4>
              <p id="delete-ann-desc" className="mt-2 text-sm leading-relaxed text-slate-600">
                <span className="font-semibold text-slate-800">&ldquo;{deleteTarget.title}&rdquo;</span> will be removed for all donors. This cannot be undone.
              </p>
            </div>
            <div className="flex flex-col-reverse gap-2 px-6 py-4 sm:flex-row sm:justify-end sm:gap-3">
              <button
                type="button"
                onClick={() => !deleting && setDeleteTarget(null)}
                className="min-h-11 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                disabled={deleting}
              >
                Keep announcement
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="min-h-11 rounded-2xl bg-red-600 px-5 text-sm font-semibold text-white shadow-lg shadow-red-600/25 transition hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Container — same pattern as /admin/partners */}
      {notification && (
        <div className="fixed right-4 top-4 z-60 transition-all duration-300 ease-in-out">
          <div
            className={`flex min-w-[300px] max-w-md items-center gap-3 rounded-lg border px-4 py-3 shadow-lg ${
              notification.type === 'destructive'
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-emerald-200 bg-emerald-50 text-emerald-900'
            }`}
          >
            {notification.type === 'destructive' ? (
              <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <p className="flex-1 text-sm font-medium">{notification.message}</p>
            <button
              type="button"
              onClick={() => setNotification(null)}
              className={`shrink-0 rounded p-1 transition hover:opacity-70 ${
                notification.type === 'destructive'
                  ? 'text-red-600 hover:bg-red-100'
                  : 'text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
      </React.Fragment>
    </AdminLayout>
  )
}

export default AdminAnnouncements
