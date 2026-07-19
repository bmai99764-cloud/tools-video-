import React, { useState } from 'react';
import { Play, RotateCcw, Download, Trash2, Video, CheckCircle, AlertTriangle, Loader2, Eye, EyeOff, FileText, Image as ImageIcon, Sparkles } from 'lucide-react';
import { VideoJob } from '../types';

interface JobListProps {
  jobs: VideoJob[];
  onRetryJob: (id: string) => void;
  onDeleteJob: (id: string) => void;
}

export default function JobList({ jobs, onRetryJob, onDeleteJob }: JobListProps) {
  const [playingJobId, setPlayingJobId] = useState<string | null>(null);

  const getStatusBadge = (status: VideoJob['status']) => {
    switch (status) {
      case 'idle':
        return (
          <span className="flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-400 bg-slate-950 border border-slate-850 rounded">
            <span className="w-1 h-1 rounded-full bg-slate-500" />
            Đang Chờ
          </span>
        );
      case 'queueing':
        return (
          <span className="flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold uppercase text-blue-400 bg-blue-950/40 border border-blue-900/30 rounded">
            <span className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" />
            Đang Đợi
          </span>
        );
      case 'running':
        return (
          <span className="flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-400 bg-amber-950/40 border border-amber-900/30 rounded">
            <Loader2 className="w-2.5 h-2.5 animate-spin text-amber-400" />
            Đang Tạo
          </span>
        );
      case 'completed':
        return (
          <span className="flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-400 bg-emerald-950/40 border border-emerald-900/30 rounded">
            <CheckCircle className="w-2.5 h-2.5 text-emerald-400" />
            Hoàn tất
          </span>
        );
      case 'failed':
        return (
          <span className="flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold uppercase text-red-400 bg-red-950/40 border border-red-900/30 rounded">
            <AlertTriangle className="w-2.5 h-2.5 text-red-400" />
            Thất bại
          </span>
        );
    }
  };

  const handleTogglePlay = (jobId: string) => {
    if (playingJobId === jobId) {
      setPlayingJobId(null);
    } else {
      setPlayingJobId(jobId);
    }
  };

  return (
    <div id="job-list-container" className="bg-[#1E293B] border border-slate-800 rounded-lg overflow-hidden shadow-md">
      <div className="px-4 py-3 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
        <h3 className="text-xs font-bold text-slate-100 flex items-center gap-1.5 uppercase tracking-wider">
          <Video className="w-4 h-4 text-indigo-400" />
          Danh sách Nhiệm vụ ({jobs.length} Jobs)
        </h3>
        <span className="text-[9px] text-slate-500 font-medium">Click "XEM" để mở trình xem video trực tiếp</span>
      </div>

      {jobs.length === 0 ? (
        <div className="p-8 text-center space-y-2">
          <div className="w-10 h-10 rounded-full bg-[#0F172A] border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
            <FileText className="w-4.5 h-4.5" />
          </div>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Danh sách trống</p>
          <p className="text-[10px] text-slate-600 max-w-xs mx-auto leading-relaxed">
            Nhập prompt ở cột cấu hình bên trái để bắt đầu lập lịch trình tạo video.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-850 overflow-x-auto">
          {/* List Rows */}
          {jobs.map((job, index) => {
            const isPlaying = playingJobId === job.id;
            const progressPercent = job.progress || 0;

            return (
              <div key={job.id} id={`job-row-${job.id}`} className="transition duration-100 hover:bg-[#020617]/20 p-3 space-y-3">
                {/* Main Row Grid */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  {/* Job Identity & Details */}
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <span className="text-[9px] font-mono font-bold text-slate-500 bg-[#0F172A] border border-slate-800 px-1.5 py-0.5 rounded mt-0.5">
                      #{String(index + 1).padStart(2, '0')}
                    </span>

                    <div className="space-y-1.5 min-w-0 flex-1">
                      {/* Prompt */}
                      <p className="text-xs font-semibold text-slate-100 leading-snug break-words">
                        {job.prompt}
                      </p>

                      {/* Configurations Badges */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-bold">
                        {/* Input type badge */}
                        <span className="bg-[#0F172A] border border-slate-850 px-1.5 py-0.5 rounded text-slate-400 uppercase flex items-center gap-1 font-sans">
                          {job.inputType === 'text' ? (
                            <FileText className="w-2.5 h-2.5 text-slate-500" />
                          ) : (
                            <ImageIcon className="w-2.5 h-2.5 text-slate-500" />
                          )}
                          {job.inputType === 'text'
                            ? 'Text'
                            : job.inputType === 'image'
                            ? 'Image'
                            : 'Frame'}
                        </span>

                        {/* Model badge */}
                        <span className="bg-indigo-950/40 text-indigo-400 border border-indigo-900/30 px-1.5 py-0.5 rounded uppercase">
                          {job.model.includes('lite') ? 'Veo Lite' : 'Veo Pro'}
                        </span>

                        {/* Aspect Ratio Badge */}
                        <span className="bg-[#0F172A] border border-slate-850 px-1.5 py-0.5 rounded font-mono text-slate-500">
                          {job.aspectRatio}
                        </span>

                        {/* Resolution badge */}
                        <span className="bg-[#0F172A] border border-slate-850 px-1.5 py-0.5 rounded font-mono text-slate-500">
                          {job.resolution}
                        </span>
                      </div>

                      {/* Display referenced thumbnails if any */}
                      {(job.image || job.lastFrame) && (
                        <div className="flex items-center gap-3 pt-0.5">
                          {job.image && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Start:</span>
                              <div className="w-6 h-6 rounded border border-slate-800 overflow-hidden bg-slate-950">
                                <img src={job.image} alt="Start thumb" className="w-full h-full object-cover" />
                              </div>
                            </div>
                          )}
                          {job.lastFrame && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">End:</span>
                              <div className="w-6 h-6 rounded border border-slate-800 overflow-hidden bg-slate-950">
                                <img src={job.lastFrame} alt="End thumb" className="w-full h-full object-cover" />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status, Progress & Controls Area */}
                  <div className="flex items-center flex-wrap gap-3 lg:self-center">
                    {/* Status badge */}
                    <div className="w-24 flex-shrink-0">
                      {getStatusBadge(job.status)}
                    </div>

                    {/* Dynamic Status Detail / Progress bar */}
                    {(job.status === 'running' || job.status === 'queueing') && (
                      <div className="w-28 flex flex-col gap-0.5">
                        <div className="flex justify-between items-center text-[8px] font-mono leading-none">
                          <span className="text-slate-500 font-bold uppercase">
                            {job.status === 'running' ? 'Đang tạo' : 'Chờ lượt'}
                          </span>
                          <span className="text-indigo-400 font-bold font-mono">{progressPercent}%</span>
                        </div>
                        <div className="w-full bg-[#0F172A] rounded h-1 overflow-hidden border border-slate-800">
                          <div
                            className="bg-indigo-500 h-full rounded transition-all duration-350"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Completion or Error Messages */}
                    {job.status === 'failed' && job.error && (
                      <div className="text-[10px] font-medium text-red-400 bg-red-955/20 border border-red-900/20 rounded px-2 py-1 max-w-[280px] break-words leading-normal" title={job.error}>
                        {job.error}
                      </div>
                    )}

                    {/* Actions buttons */}
                    <div className="flex items-center gap-1 ml-auto lg:ml-0">
                      {/* View Inline player (collapsible) */}
                      {job.status === 'completed' && job.operationName && (
                        <button
                          id={`play-inline-btn-${job.id}`}
                          type="button"
                          onClick={() => handleTogglePlay(job.id)}
                          className={`px-2 py-1 rounded border text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer ${
                            isPlaying
                              ? 'bg-indigo-600 border-indigo-500 text-white'
                              : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-900'
                          }`}
                        >
                          {isPlaying ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          {isPlaying ? 'Ẩn' : 'Xem'}
                        </button>
                      )}

                      {/* Download */}
                      {job.status === 'completed' && job.operationName && (
                        <a
                          id={`download-video-btn-${job.id}`}
                          href={`/api/video/download?operationName=${encodeURIComponent(job.operationName)}&filename=${encodeURIComponent(`gemini-video-${job.id}.mp4`)}`}
                          download={`gemini-video-${job.id}.mp4`}
                          className="p-1 bg-[#0F172A] border border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-white rounded transition cursor-pointer flex items-center justify-center"
                          title="Tải xuống video"
                        >
                          <Download className="w-3 h-3" />
                        </a>
                      )}

                      {/* Retry */}
                      {job.status === 'failed' && (
                        <button
                          id={`retry-job-btn-${job.id}`}
                          type="button"
                          onClick={() => onRetryJob(job.id)}
                          className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded transition flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider cursor-pointer"
                          title="Thử lại nhiệm vụ"
                        >
                          <RotateCcw className="w-2.5 h-2.5" />
                          Thử Lại
                        </button>
                      )}

                      {/* Delete */}
                      <button
                        id={`delete-job-btn-${job.id}`}
                        type="button"
                        onClick={() => onDeleteJob(job.id)}
                        disabled={job.status === 'running'}
                        className="p-1 bg-[#0F172A] border border-slate-800 hover:border-red-900 hover:bg-red-955/20 text-slate-500 hover:text-red-400 rounded transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center"
                        title="Xóa khỏi hàng đợi"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Collapsible Inline Video Player Form */}
                {isPlaying && job.status === 'completed' && job.operationName && (
                  <div
                    id={`video-player-row-${job.id}`}
                    className="bg-slate-950 border border-slate-800/80 rounded p-3 relative animate-fade-in"
                  >
                    <div className="max-w-xl mx-auto space-y-2">
                      <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-wider">
                        <span className="text-slate-400 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-indigo-400" />
                          Trực Tiếp (Live Preview)
                        </span>
                        <span className="text-slate-600 font-mono">
                          ID: {job.id}
                        </span>
                      </div>
                      
                      {/* Actual HTML5 Video Tag with custom responsive styling based on aspect ratio */}
                      <div
                        className={`mx-auto bg-black rounded overflow-hidden border border-slate-800 shadow-lg relative flex items-center justify-center ${
                          job.aspectRatio === '9:16'
                            ? 'max-w-[200px] aspect-[9/16]'
                            : job.aspectRatio === '1:1'
                            ? 'max-w-[300px] aspect-square'
                            : 'w-full aspect-[16/9]'
                        }`}
                      >
                        <video
                          src={`/api/video/view?operationName=${encodeURIComponent(job.operationName)}`}
                          controls
                          autoPlay
                          playsInline
                          className="w-full h-full object-contain"
                        />
                      </div>
                      
                      <div className="flex justify-between items-center text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                        <span>Định dạng: {job.resolution} ({job.aspectRatio})</span>
                        <a
                          href={`/api/video/view?operationName=${encodeURIComponent(job.operationName)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-400 hover:text-indigo-300 transition underline"
                        >
                          Mở tab mới
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
