'use client';

import { useState, useRef } from 'react';
import { ExternalLink, MessageSquare, Trash2, ChevronDown, ChevronUp, Tag, Sparkles } from 'lucide-react';
import type { Paper, RatingValue, Comment } from '../types';
import RatingStars from './RatingStars';
import { usePaperStore } from '../store';

interface Props {
  paper: Paper;
  venueColor: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Large Language Models': 'bg-purple-100 text-purple-700',
  'Computer Vision': 'bg-blue-100 text-blue-700',
  'Natural Language Processing': 'bg-green-100 text-green-700',
  'Reinforcement Learning': 'bg-orange-100 text-orange-700',
  'Graph Neural Networks': 'bg-pink-100 text-pink-700',
  'Generative Models': 'bg-violet-100 text-violet-700',
  'Multimodal Learning': 'bg-cyan-100 text-cyan-700',
  'Optimization & Theory': 'bg-yellow-100 text-yellow-700',
  default: 'bg-gray-100 text-gray-600',
};

function getCategoryColor(cat: string) {
  return CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.default;
}

export default function PaperCard({ paper, venueColor }: Props) {
  const { updateRating, updateComment, deletePaper } = usePaperStore();
  const [expanded, setExpanded] = useState(false);
  const [commentText, setCommentText] = useState(paper.comment?.text ?? '');
  const [editingComment, setEditingComment] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasComment = !!paper.comment?.text;
  const authorStr = paper.authors.length > 0
    ? paper.authors
        .slice(0, 4)
        .map((a) => a.name)
        .join(', ') + (paper.authors.length > 4 ? ` +${paper.authors.length - 4}` : '')
    : 'Unknown Authors';

  function handleSaveComment() {
    const trimmed = commentText.trim();
    const comment: Comment = {
      id: paper.comment?.id ?? crypto.randomUUID(),
      text: trimmed,
      createdAt: paper.comment?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    updateComment(paper.id, comment);
    setEditingComment(false);
  }

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      deleteTimerRef.current = setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    deletePaper(paper.id);
  }

  return (
    <article
      className="rounded-xl border transition-shadow hover:shadow-md"
      style={{
        background: 'var(--pixel-card-bg)',
        borderColor: 'var(--pixel-border)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Main row */}
      <div className="p-4">
        {/* Top meta row */}
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span
            className="px-2 py-0.5 rounded-full text-xs font-semibold text-white"
            style={{ background: venueColor }}
          >
            {paper.venue}
          </span>
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            {paper.year}
          </span>
          {paper.venueType === 'journal' && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-600">
              Journal
            </span>
          )}
          {paper.ai_category?.map((cat) => (
            <span
              key={cat}
              className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${getCategoryColor(cat)}`}
            >
              <Tag size={10} />
              {cat}
            </span>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <RatingStars
              value={paper.rating}
              onChange={(v) => updateRating(paper.id, v as RatingValue)}
              size="sm"
            />
          </div>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-sm leading-snug mb-1" style={{ color: 'var(--pixel-text)' }}>
          {paper.ee ? (
            <a
              href={paper.ee}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-indigo-600 transition-colors"
            >
              {paper.title}
            </a>
          ) : (
            paper.title
          )}
        </h3>

        {/* Authors */}
        <p className="text-xs mb-3" style={{ color: 'var(--pixel-muted)' }}>
          {authorStr}
        </p>

        {/* Action row */}
        <div className="flex items-center gap-2">
          {paper.ee && (
            <a
              href={paper.ee}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 transition-colors"
            >
              <ExternalLink size={12} />
              Open
            </a>
          )}
          {paper.doi && (
            <span className="text-xs" style={{ color: 'var(--pixel-muted)' }}>
              DOI: {paper.doi.slice(0, 30)}{paper.doi.length > 30 ? '…' : ''}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => { setExpanded(!expanded); if (!expanded) setEditingComment(false); }}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors ${
                hasComment
                  ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                  : 'text-gray-400 hover:bg-gray-100'
              }`}
            >
              <MessageSquare size={12} />
              {hasComment ? 'Note' : 'Add note'}
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            <button
              onClick={handleDelete}
              title={confirmDelete ? 'Click again to confirm delete' : 'Delete paper'}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-all ${
                confirmDelete
                  ? 'bg-red-100 text-red-600 hover:bg-red-200 font-medium'
                  : 'text-gray-300 hover:text-red-400 hover:bg-gray-100'
              }`}
            >
              <Trash2 size={12} />
              {confirmDelete && <span>Confirm?</span>}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded comment section */}
      {expanded && (
        <div
          className="border-t px-4 pb-4 pt-3"
          style={{ borderColor: 'var(--pixel-border)' }}
        >
          {!editingComment && hasComment ? (
            <div>
              <div
                className="text-xs rounded-lg p-3 whitespace-pre-wrap"
                style={{ background: 'var(--pixel-bg-alt)', color: 'var(--pixel-text)' }}
              >
                {paper.comment?.text}
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs" style={{ color: 'var(--pixel-muted)' }}>
                  {paper.comment?.updatedAt
                    ? `Updated ${new Date(paper.comment.updatedAt).toLocaleDateString()}`
                    : ''}
                </span>
                <button
                  onClick={() => { setCommentText(paper.comment?.text ?? ''); setEditingComment(true); }}
                  className="text-xs text-indigo-500 hover:text-indigo-700"
                >
                  Edit
                </button>
              </div>
            </div>
          ) : (
            <div>
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add notes in Markdown... (# Heading, **bold**, - list items)"
                rows={4}
                className="w-full text-xs rounded-lg p-3 resize-y border outline-none focus:ring-2 focus:ring-indigo-400 transition"
                style={{
                  background: 'var(--pixel-bg)',
                  borderColor: 'var(--pixel-border)',
                  color: 'var(--pixel-text)',
                }}
              />
              <div className="flex justify-end gap-2 mt-2">
                <button
                  onClick={() => { setEditingComment(false); setCommentText(paper.comment?.text ?? ''); }}
                  className="text-xs px-3 py-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveComment}
                  disabled={!commentText.trim()}
                  className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition"
                >
                  Save
                </button>
              </div>
            </div>
          )}
          {!hasComment && !editingComment && (
            <button
              onClick={() => setEditingComment(true)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-500 transition"
            >
              <Sparkles size={12} /> Write a note…
            </button>
          )}
        </div>
      )}
    </article>
  );
}
