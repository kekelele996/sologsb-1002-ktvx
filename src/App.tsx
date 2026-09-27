import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeftOutlined, ArrowRightOutlined, BranchesOutlined, CheckOutlined, CloseOutlined,
  CommentOutlined, DiffOutlined, DeleteOutlined, FieldTimeOutlined, FileDoneOutlined, FileTextOutlined,
  HistoryOutlined, LockOutlined, MenuFoldOutlined, MessageOutlined, PlayCircleOutlined, PlusOutlined,
  RedoOutlined, SaveOutlined, SendOutlined, StopOutlined, SwapOutlined, UndoOutlined, UnlockOutlined, UserSwitchOutlined,
} from '@ant-design/icons'
import { Alert, Badge, Button, Card, Checkbox, Divider, Empty, Input, Modal, Progress, Radio, Segmented, Select, Space, Tag, Tooltip, message } from 'antd'
import { submitRemotePatch } from './services/mockApi'
import { useReviewStore } from './store/review'
import type { Comment, CommentType, Paragraph, Role } from './types'

const roleMeta: Record<Role, { label: string; description: string; color: string }> = {
  author: { label: '作者工作区', description: '编辑正文，逐条接受或拒绝修改建议', color: '#2f6f5e' },
  reviewer: { label: '审稿人工作区', description: '引用原文、添加批注与修改建议并参与讨论', color: '#9a5b25' },
  editor: { label: '编辑工作区', description: '合并重复意见、锁定已确认段落并比较版本', color: '#5b4d8e' },
}
const roleIcon = (role: Role) => role === 'author' ? <FileDoneOutlined /> : role === 'reviewer' ? <CommentOutlined /> : <BranchesOutlined />
const formatDate = (value: number) => new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })

export default function App() {
  const {
    role, paragraphs, comments, versions, batches, selectedParagraphId, commentFilter, revisionMode, dirty, conflicts,
    setRole, selectParagraph, setCommentFilter, setRevisionMode, updateParagraph, addComment, replyComment,
    resolveSuggestion, mergeComment, resolveComment, toggleLock, createVersion, startBatch, closeBatch, confirmComment, withdrawComment,
    addConflict, resolveConflict, dismissConflict, undo, redo, save, resetDemo,
  } = useReviewStore()
  const [composerOpen, setComposerOpen] = useState(false)
  const [commentType, setCommentType] = useState<CommentType>('comment')
  const [commentBody, setCommentBody] = useState('')
  const [suggestion, setSuggestion] = useState('')
  const [quote, setQuote] = useState('')
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
  const [versionOpen, setVersionOpen] = useState(false)
  const [versionA, setVersionA] = useState(versions[1]?.id ?? versions[0]?.id)
  const [versionB, setVersionB] = useState(versions[0]?.id)
  const [versionLabel, setVersionLabel] = useState('')
  const [batchLabel, setBatchLabel] = useState('')
  const [confirmingComment, setConfirmingComment] = useState<Comment | null>(null)
  const [confirmQuote, setConfirmQuote] = useState('')
  const [confirmSuggestion, setConfirmSuggestion] = useState('')

  const selected = paragraphs.find((paragraph) => paragraph.id === selectedParagraphId) ?? paragraphs[0]
  const sections = useMemo(() => Array.from(new Set(paragraphs.map((paragraph) => paragraph.section))), [paragraphs])
  const paragraphCommentCounts = useMemo(() => comments.reduce<Record<string, number>>((acc, comment) => {
    acc[comment.paragraphId] = (acc[comment.paragraphId] ?? 0) + 1
    return acc
  }, {}), [comments])
  const duplicateParagraphIds = useMemo(() => new Set(Object.entries(paragraphCommentCounts).filter(([, count]) => count > 1).map(([id]) => id)), [paragraphCommentCounts])
  const visibleComments = useMemo(() => comments.filter((comment) => {
    if (commentFilter === 'open') return comment.status === 'open' || comment.status === 'outdated'
    if (commentFilter === 'suggestion') return comment.type === 'suggestion' && (comment.status === 'open' || comment.status === 'outdated')
    if (commentFilter === 'duplicate') return duplicateParagraphIds.has(comment.paragraphId) && comment.status === 'open'
    return true
  }).sort((a, b) => b.createdAt - a.createdAt), [commentFilter, comments, duplicateParagraphIds])

  const activeBatch = batches.find((batch) => batch.status === 'draft')
  const batchComments = useMemo(() => activeBatch ? comments.filter((comment) => comment.batchId === activeBatch.id) : [], [activeBatch, comments])
  const pendingComments = useMemo(() => batchComments.filter((comment) => comment.status === 'open' || comment.status === 'outdated'), [batchComments])
  const outdatedComments = useMemo(() => batchComments.filter((comment) => comment.status === 'outdated'), [batchComments])
  const batchChangedParagraphIds = useMemo(() => {
    if (!activeBatch) return new Set<string>()
    return new Set(paragraphs
      .filter((paragraph) => activeBatch.paragraphBaselines[paragraph.id] !== undefined && activeBatch.paragraphBaselines[paragraph.id] !== paragraph.text)
      .map((paragraph) => paragraph.id))
  }, [activeBatch, paragraphs])
  const closedBatches = batches.filter((batch) => batch.status === 'closed')

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [dirty])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) return
      const state = useReviewStore.getState()
      const index = state.paragraphs.findIndex((paragraph) => paragraph.id === state.selectedParagraphId)
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        event.shiftKey ? state.redo() : state.undo()
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault(); state.redo()
      } else if (event.key.toLowerCase() === 'j') {
        event.preventDefault(); const next = state.paragraphs[Math.min(state.paragraphs.length - 1, index + 1)]; if (next) state.selectParagraph(next.id)
      } else if (event.key.toLowerCase() === 'k') {
        event.preventDefault(); const previous = state.paragraphs[Math.max(0, index - 1)]; if (previous) state.selectParagraph(previous.id)
      } else if (event.key.toLowerCase() === 't') {
        event.preventDefault(); state.setRevisionMode(!state.revisionMode)
      } else if (event.key.toLowerCase() === 'l' && state.role === 'editor') {
        event.preventDefault(); state.toggleLock(state.selectedParagraphId)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const scrollToParagraph = (id: string) => {
    selectParagraph(id)
    document.getElementById(`paragraph-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
  const openComposer = (type: CommentType) => {
    const selectedText = window.getSelection()?.toString().trim()
    setQuote(selectedText && selected?.text.includes(selectedText) ? selectedText : selected?.text.slice(0, 64) ?? '')
    setSuggestion(type === 'suggestion' ? selected?.text ?? '' : '')
    setCommentType(type)
    setComposerOpen(true)
  }
  const submitComment = () => {
    if (!selected || !commentBody.trim()) { message.warning('请填写批注内容'); return }
    addComment({ paragraphId: selected.id, type: commentType, quote, body: commentBody.trim(), suggestion: commentType === 'suggestion' ? suggestion : undefined })
    setCommentBody(''); setSuggestion(''); setQuote(''); setComposerOpen(false)
    message.success(commentType === 'suggestion' ? '修改建议已提交' : '段落批注已添加')
  }
  const handleMockConflict = async () => {
    if (!selected) return
    const response = await submitRemotePatch(selected)
    addConflict({
      id: `conflict-${Date.now()}`, paragraphId: selected.id, localText: selected.text, remoteText: response.remoteText,
      localAuthor: roleMeta[role].label, remoteAuthor: response.remoteAuthor, detectedAt: Date.now(),
    })
    message.warning('模拟接口返回了同段落的远端修改，请处理冲突')
  }
  const handleCreateVersion = () => {
    if (versionLabel.trim()) createVersion(versionLabel.trim())
    else createVersion('')
    setVersionLabel('')
    message.success('当前版本已保存')
  }
  const handleStartBatch = () => {
    startBatch(batchLabel)
    setBatchLabel('')
    message.success('审阅批次已开始：已记录各段文字与待处理意见')
  }
  const handleCloseBatch = () => {
    const result = closeBatch()
    if (result.ok) message.success(`批次已结束，正文已存为新版本「${result.versionLabel}」`)
    else message.warning(`还有 ${result.pending.length} 条意见未处理（含 ${result.pending.filter((item) => item.status === 'outdated').length} 条过时意见），全部处理完才能结束批次`)
  }
  const openConfirmComment = (comment: Comment) => {
    setConfirmingComment(comment)
    const paragraph = paragraphs.find((item) => item.id === comment.paragraphId)
    setConfirmQuote(comment.quote)
    setConfirmSuggestion(comment.type === 'suggestion' ? paragraph?.text ?? comment.suggestion ?? '' : comment.suggestion ?? '')
  }
  const submitConfirmComment = () => {
    if (!confirmingComment) return
    confirmComment(confirmingComment.id, {
      quote: confirmQuote.trim() || confirmingComment.quote,
      suggestion: confirmingComment.type === 'suggestion' ? confirmSuggestion : undefined,
    })
    setConfirmingComment(null)
    message.success('审稿人已按新文字确认，意见恢复为待处理')
  }
  const comparedA = versions.find((version) => version.id === versionA)
  const comparedB = versions.find((version) => version.id === versionB)
  const comparedRows = comparedA && comparedB ? comparedA.paragraphs.map((paragraph, index) => ({ a: paragraph, b: comparedB.paragraphs[index] })) : []

  return (
    <div className="review-app">
      <header className="app-header">
        <div className="paper-identity">
          <div className="paper-mark">CR</div>
          <div><h1>学术论文协作审阅台</h1><p>Collaborative Research Review · MS-2026-0417</p></div>
        </div>
        <div className="role-switch">
          <Segmented block value={role} onChange={(value) => setRole(value as Role)} options={(Object.keys(roleMeta) as Role[]).map((item) => ({ label: <span>{roleIcon(item)} {roleMeta[item].label.replace('工作区', '')}</span>, value: item }))} />
        </div>
        <Space>
          <Badge dot={dirty}><Button icon={<SaveOutlined />} onClick={() => { save(); message.success('草稿已保存到浏览器') }}>保存</Button></Badge>
          <Button icon={<UndoOutlined />} disabled={!useReviewStore.getState().past.length} onClick={undo} />
          <Button icon={<RedoOutlined />} disabled={!useReviewStore.getState().future.length} onClick={redo} />
          <Button danger={conflicts.length > 0} icon={<SwapOutlined />} onClick={() => void handleMockConflict()}>模拟冲突</Button>
        </Space>
      </header>

      <div className="role-banner" style={{ '--role-color': roleMeta[role].color } as React.CSSProperties}>
        <span className="role-badge">{roleIcon(role)} {roleMeta[role].label}</span>
        <span>{roleMeta[role].description}</span>
        <span className="paper-state"><FileTextOutlined /> 论文正文 v2.4</span>
      </div>

      {conflicts.length > 0 && (
        <div className="conflict-stack">
          {conflicts.map((conflict) => (
            <Alert
              key={conflict.id} type="error" showIcon message={`段落冲突：${conflict.localAuthor} 与 ${conflict.remoteAuthor} 同时修改`}
              description={(
                <div className="conflict-content">
                  <div><b>本页版本</b><p>{conflict.localText}</p></div>
                  <div><b>模拟远端版本</b><p>{conflict.remoteText}</p></div>
                  <Space><Button size="small" onClick={() => resolveConflict(conflict.id, 'local')}>保留本页</Button><Button size="small" type="primary" onClick={() => resolveConflict(conflict.id, 'remote')}>采用远端</Button><Button size="small" type="text" onClick={() => dismissConflict(conflict.id)}>稍后处理</Button></Space>
                </div>
              )}
            />
          ))}
        </div>
      )}

      <main className="workspace">
        <aside className="toc-panel">
          <div className="panel-title"><MenuFoldOutlined /> 侧边目录</div>
          <nav>
            {sections.map((section) => (
              <div key={section} className="toc-section">
                <strong>{section}</strong>
                {paragraphs.filter((paragraph) => paragraph.section === section).map((paragraph) => (
                  <button key={paragraph.id} className={paragraph.id === selected?.id ? 'active' : ''} onClick={() => scrollToParagraph(paragraph.id)}>
                    <span>{paragraph.number}</span>
                    <span>{paragraph.text.slice(0, 24)}…</span>
                    {paragraph.status === 'locked' && <LockOutlined />}
                    {!!paragraphCommentCounts[paragraph.id] && <Badge count={paragraphCommentCounts[paragraph.id]} size="small" />}
                  </button>
                ))}
              </div>
            ))}
          </nav>
          <div className="batch-box">
            <div className="panel-title"><FieldTimeOutlined /> 审阅批次</div>
            {activeBatch ? (
              <div className="batch-active">
                <div className="batch-name">
                  <Tag color="processing">进行中</Tag>
                  <b title={activeBatch.label}>{activeBatch.label}</b>
                </div>
                <small>开始于 {formatDate(activeBatch.startedAt)}</small>
                <Progress
                  percent={batchComments.length ? Math.round(((batchComments.length - pendingComments.length) / batchComments.length) * 100) : 100}
                  size="small" status={pendingComments.length ? 'active' : 'success'}
                />
                <div className="batch-stats">
                  <span>纳入意见 <b>{batchComments.length}</b></span>
                  <span>待处理 <b className={pendingComments.length ? 'warn' : ''}>{pendingComments.length}</b></span>
                  <span>过时 <b className={outdatedComments.length ? 'danger' : ''}>{outdatedComments.length}</b></span>
                </div>
                {batchChangedParagraphIds.size > 0 && (
                  <p className="batch-tip">本批次已有 {batchChangedParagraphIds.size} 段文字变化，旧文字上的建议已暂停接受。</p>
                )}
                {role === 'editor' ? (
                  <Button block size="small" type="primary" icon={<StopOutlined />} onClick={handleCloseBatch}>结束批次并存为新版本</Button>
                ) : (
                  <p className="batch-tip">批次由编辑结束；未结束的草稿刷新后仍可继续处理。</p>
                )}
              </div>
            ) : (
              <div className="batch-idle">
                {role === 'editor' ? (
                  <>
                    <Input size="small" value={batchLabel} onChange={(event) => setBatchLabel(event.target.value)} placeholder="批次名称（如外审第二轮）" onPressEnter={handleStartBatch} />
                    <Button block size="small" icon={<PlayCircleOutlined />} onClick={handleStartBatch}>开始审阅批次</Button>
                    <small>开始时锁定各段文字与待处理意见；批次中新增的批注建议自动归入。</small>
                  </>
                ) : (
                  <small className="batch-muted">编辑尚未开始审阅批次。批次进行中，审稿人新增的批注与建议会自动归入。</small>
                )}
                {closedBatches.length > 0 && (
                  <div className="batch-history">
                    <Divider plain style={{ margin: '8px 0', fontSize: 10 }}>已结束 {closedBatches.length}</Divider>
                    {closedBatches.map((batch) => (
                      <div key={batch.id} className="batch-closed-item">
                        <Tag color="default" icon={<CheckOutlined />}>已结束</Tag>
                        <span title={batch.label}>{batch.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="version-box">
            <div className="panel-title"><HistoryOutlined /> 版本</div>
            <Input value={versionLabel} onChange={(event) => setVersionLabel(event.target.value)} placeholder="新版本名称" onPressEnter={handleCreateVersion} />
            <Button block icon={<PlusOutlined />} onClick={handleCreateVersion}>保存当前版本</Button>
            <Button block icon={<DiffOutlined />} onClick={() => setVersionOpen(true)}>比较两个版本</Button>
          </div>
        </aside>

        <section className="document-panel">
          <div className="document-toolbar">
            <div><h2>大语言模型辅助下的开源维护协作研究</h2><p>作者：林晓、陈默、王远 · 最近保存 {formatDate(Date.now())}</p></div>
            <Space>
              <Checkbox checked={revisionMode} onChange={(event) => setRevisionMode(event.target.checked)}>修订模式</Checkbox>
              <Tag color={dirty ? 'gold' : 'green'}>{dirty ? '有未保存修改' : '已保存'}</Tag>
            </Space>
          </div>

          <div className="paper-sheet">
            <div className="paper-kicker">RESEARCH ARTICLE · CONFIDENTIAL REVIEW</div>
            {sections.map((section) => (
              <section key={section} className="paper-section">
                <h3>{section}</h3>
                {paragraphs.filter((paragraph) => paragraph.section === section).map((paragraph) => (
                  <article
                    id={`paragraph-${paragraph.id}`} key={paragraph.id} onMouseUp={() => setQuote(window.getSelection()?.toString().trim() ?? '')}
                    className={`paragraph-card ${paragraph.id === selected?.id ? 'selected' : ''} ${paragraph.highlighted ? 'highlighted' : ''} ${paragraph.status === 'locked' ? 'locked' : ''}`}
                    onClick={() => selectParagraph(paragraph.id)}
                  >
                    <div className="paragraph-meta">
                      <span className="paragraph-no">{paragraph.number}</span>
                      <span>段落 {paragraph.number.replace('.', '')}</span>
                      {paragraph.status === 'locked' && <Tag icon={<LockOutlined />} color="purple">已锁定</Tag>}
                      {paragraph.status === 'accepted' && <Tag icon={<CheckOutlined />} color="green">已确认</Tag>}
                      {activeBatch && batchChangedParagraphIds.has(paragraph.id) && <Tooltip title="该段在本批次中改动过，旧文字上的待处理建议已标为过时"><Tag icon={<FieldTimeOutlined />} color="orange">本批次已改</Tag></Tooltip>}
                      {!!paragraphCommentCounts[paragraph.id] && <Tag icon={<MessageOutlined />}>{paragraphCommentCounts[paragraph.id]} 条意见</Tag>}
                    </div>
                    {revisionMode ? (
                      <div className="revision-grid">
                        <div><small>原稿</small><p>{paragraph.original}</p></div>
                        <div><small>当前修订</small><p>{paragraph.text}</p></div>
                      </div>
                    ) : role === 'author' ? (
                      <Input.TextArea autoSize={{ minRows: 2, maxRows: 8 }} value={paragraph.text} readOnly={paragraph.status === 'locked'} onChange={(event) => updateParagraph(paragraph.id, event.target.value)} />
                    ) : (
                      <p className="paragraph-text">{paragraph.text}</p>
                    )}
                    <div className="paragraph-actions">
                      {role === 'reviewer' && <><Button size="small" icon={<CommentOutlined />} onClick={(event) => { event.stopPropagation(); selectParagraph(paragraph.id); openComposer('comment') }}>添加批注</Button><Button size="small" icon={<FileDoneOutlined />} onClick={(event) => { event.stopPropagation(); selectParagraph(paragraph.id); openComposer('suggestion') }}>提出建议</Button></>}
                      {role === 'editor' && <Button size="small" icon={paragraph.status === 'locked' ? <UnlockOutlined /> : <LockOutlined />} onClick={(event) => { event.stopPropagation(); toggleLock(paragraph.id) }}>{paragraph.status === 'locked' ? '解除锁定' : '锁定段落'}</Button>}
                      {role === 'author' && <span className="author-tip">可直接修改正文，右侧逐条处理建议</span>}
                    </div>
                  </article>
                ))}
              </section>
            ))}
          </div>
        </section>

        <aside className="comments-panel">
          <div className="comments-header">
            <div><h2><CommentOutlined /> 审阅意见 <Badge count={comments.filter((comment) => comment.status === 'open' || comment.status === 'outdated').length} /></h2><p>引用原文、讨论与修订建议</p></div>
          </div>
          <div className="comment-filters">
            <Radio.Group value={commentFilter} onChange={(event) => setCommentFilter(event.target.value)} buttonStyle="solid" size="small">
              <Radio.Button value="all">全部</Radio.Button><Radio.Button value="open">待处理</Radio.Button><Radio.Button value="suggestion">建议</Radio.Button><Radio.Button value="duplicate">重复</Radio.Button>
            </Radio.Group>
          </div>
          <div className="comment-list">
            {visibleComments.map((comment) => {
              const paragraph = paragraphs.find((item) => item.id === comment.paragraphId)
              return (
                <Card key={comment.id} size="small" className={`comment-card ${comment.status}`} title={<span>{comment.author} <Tag>{comment.type === 'suggestion' ? '修改建议' : '段落批注'}</Tag>{!!comment.batchId && <Tag color="geekblue">批次意见</Tag>}</span>} extra={<small>{formatDate(comment.createdAt)}</small>}>
                  <button className="quote-line" onClick={() => paragraph && scrollToParagraph(paragraph.id)}>“{comment.quote}” · 段落 {paragraph?.number}</button>
                  <p className="comment-body">{comment.body}</p>
                  {comment.suggestion && <div className="suggestion-box"><small>建议改为</small><p>{comment.suggestion}</p></div>}
                  {comment.status === 'outdated' && (
                    <Alert
                      className="outdated-alert" type="warning" showIcon
                      message="该意见基于旧文字，已过时并暂停接受"
                      description={role === 'reviewer'
                        ? '段落已按新稿修改，请按新文字确认意见（可修订引用与建议）或直接撤回。'
                        : '需等待审稿人按新文字确认或撤回后，作者才能继续处理。'}
                    />
                  )}
                  {comment.status !== 'open' && comment.status !== 'outdated' && <Tag color={comment.status === 'accepted' ? 'green' : comment.status === 'rejected' ? 'red' : comment.status === 'merged' ? 'blue' : 'default'}>{comment.status === 'accepted' ? '已接受' : comment.status === 'rejected' ? '已拒绝' : comment.status === 'merged' ? '已合并' : '已撤回'}</Tag>}
                  <div className="replies">
                    {comment.replies.map((reply) => <div key={reply.id} className="reply"><b>{reply.author}</b><span>{reply.body}</span></div>)}
                  </div>
                  <div className="reply-box">
                    <Input size="small" value={replyDrafts[comment.id] ?? ''} onChange={(event) => setReplyDrafts((drafts) => ({ ...drafts, [comment.id]: event.target.value }))} placeholder="回复讨论…" onPressEnter={() => { const body = replyDrafts[comment.id]?.trim(); if (body) { replyComment(comment.id, body); setReplyDrafts((drafts) => ({ ...drafts, [comment.id]: '' })) } }} />
                    <Button size="small" type="text" icon={<SendOutlined />} onClick={() => { const body = replyDrafts[comment.id]?.trim(); if (body) { replyComment(comment.id, body); setReplyDrafts((drafts) => ({ ...drafts, [comment.id]: '' })) } }} />
                  </div>
                  {comment.status === 'open' && role === 'author' && comment.type === 'suggestion' && <div className="decision-row"><Button type="primary" size="small" icon={<CheckOutlined />} onClick={() => resolveSuggestion(comment.id, true)}>接受修改</Button><Button danger size="small" icon={<CloseOutlined />} onClick={() => resolveSuggestion(comment.id, false)}>拒绝</Button></div>}
                  {comment.status === 'outdated' && role === 'reviewer' && <div className="decision-row"><Button type="primary" size="small" icon={<CheckOutlined />} onClick={() => openConfirmComment(comment)}>按新文字确认</Button><Button size="small" icon={<CloseOutlined />} onClick={() => { withdrawComment(comment.id); message.success('意见已撤回') }}>撤回</Button></div>}
                  {comment.status === 'open' && role === 'editor' && duplicateParagraphIds.has(comment.paragraphId) && (() => {
                    const sibling = comments.find((item) => item.id !== comment.id && item.paragraphId === comment.paragraphId && item.status === 'open')
                    return sibling ? <Button size="small" type="dashed" icon={<BranchesOutlined />} onClick={() => mergeComment(comment.id, sibling.id)}>合并到“{sibling.author}”意见</Button> : null
                  })()}
                  {comment.status === 'open' && role === 'editor' && <div className="decision-row"><Button size="small" icon={<CheckOutlined />} onClick={() => resolveComment(comment.id)}>标记已处理</Button></div>}
                </Card>
              )
            })}
            {!visibleComments.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前筛选下没有意见" />}
          </div>
          <div className="keyboard-hint"><span><kbd>J</kbd>/<kbd>K</kbd> 段落导航</span><span><kbd>T</kbd> 修订模式</span>{role === 'editor' && <span><kbd>L</kbd> 锁定</span>}<span><kbd>⌘Z</kbd> 撤销</span></div>
        </aside>
      </main>

      <Modal title={commentType === 'suggestion' ? '提出修改建议' : '添加段落批注'} open={composerOpen} onCancel={() => setComposerOpen(false)} onOk={submitComment} okText="提交" width={620}>
        <div className="composer">
          <label>引用原文</label>
          <Input.TextArea value={quote} onChange={(event) => setQuote(event.target.value)} autoSize={{ minRows: 2, maxRows: 4 }} />
          <label>{commentType === 'suggestion' ? '建议改为' : '批注内容'}</label>
          {commentType === 'suggestion' && <Input.TextArea value={suggestion} onChange={(event) => setSuggestion(event.target.value)} autoSize={{ minRows: 3, maxRows: 7 }} />}
          <label>说明</label>
          <Input.TextArea value={commentBody} onChange={(event) => setCommentBody(event.target.value)} placeholder="说明修改理由或希望作者关注的问题" autoSize={{ minRows: 2, maxRows: 5 }} />
        </div>
      </Modal>

      <Modal title="版本比较" open={versionOpen} onCancel={() => setVersionOpen(false)} footer={null} width={980}>
        <div className="compare-selectors">
          <Select value={versionA} onChange={setVersionA} options={versions.map((version) => ({ label: `${version.label} · ${formatDate(version.createdAt)}${version.batchId ? ' · 批次结项' : ''}`, value: version.id }))} />
          <ArrowRightOutlined />
          <Select value={versionB} onChange={setVersionB} options={versions.map((version) => ({ label: `${version.label} · ${formatDate(version.createdAt)}${version.batchId ? ' · 批次结项' : ''}`, value: version.id }))} />
        </div>
        <div className="version-table">
          <div className="version-head"><b>{comparedA?.label ?? '版本 A'}</b><b>{comparedB?.label ?? '版本 B'}</b></div>
          {comparedRows.map(({ a, b }) => (
            <div key={a.id} className={`version-row ${a.text !== b?.text ? 'changed' : ''}`}>
              <div><span>{a.number}</span>{a.text}</div><div><span>{b?.number ?? '—'}</span>{b?.text ?? '段落已删除'}</div>
            </div>
          ))}
        </div>
      </Modal>

      <Modal
        title="按新文字确认意见" open={!!confirmingComment} onCancel={() => setConfirmingComment(null)} onOk={submitConfirmComment}
        okText="确认并恢复待处理" cancelText="取消" width={620}
      >
        {confirmingComment && (
          <div className="composer">
            <Alert type="info" showIcon message="段落文字已变化，请核对意见是否仍适用于新稿；确认后重新锚定到当前文字。" />
            <label>新稿文字</label>
            <div className="new-text-box">{paragraphs.find((item) => item.id === confirmingComment.paragraphId)?.text}</div>
            <label>修订引用原文</label>
            <Input.TextArea value={confirmQuote} onChange={(event) => setConfirmQuote(event.target.value)} autoSize={{ minRows: 1, maxRows: 3 }} />
            {confirmingComment.type === 'suggestion' && (
              <>
                <label>按新文字修订建议</label>
                <Input.TextArea value={confirmSuggestion} onChange={(event) => setConfirmSuggestion(event.target.value)} autoSize={{ minRows: 2, maxRows: 6 }} />
              </>
            )}
            <label>原意见说明</label>
            <p className="comment-body">{confirmingComment.body}</p>
          </div>
        )}
      </Modal>

      <footer className="app-footer">
        <span>本地草稿自动持久化 · 模拟接口用于演示多人修改后的冲突处理</span>
        <Button type="text" size="small" icon={<DeleteOutlined />} onClick={() => { resetDemo(); message.success('已重置示例数据') }}>重置示例</Button>
      </footer>
    </div>
  )
}
