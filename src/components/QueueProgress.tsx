import React, { useEffect, useState } from 'react';
import { Play, Pause, Trash2, Download, Video, ShieldAlert, Cpu, CheckCircle2, AlertCircle, Sparkles, Clock } from 'lucide-react';
import { VideoJob, QueueConfig } from '../types';

interface QueueProgressProps {
  jobs: VideoJob[];
  config: QueueConfig;
  onConfigChange: (config: QueueConfig) => void;
  isProcessing: boolean;
  onStartProcessing: () => void;
  onStopProcessing: () => void;
  onClearJobs: () => void;
  hasApiKey: boolean;
  rateLimitHistory: number[]; // timestamps of jobs started in the last 60 seconds
  handleDownloadAll: () => void;
}

export default function QueueProgress({
  jobs,
  config,
  onConfigChange,
  isProcessing,
  onStartProcessing,
  onStopProcessing,
  onClearJobs,
  hasApiKey,
  rateLimitHistory,
  handleDownloadAll
}: QueueProgressProps) {
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const totalJobs = jobs.length;
  const completedJobs = jobs.filter(j => j.status === 'completed').length;
  const runningJobs = jobs.filter(j => j.status === 'running').length;
  const failedJobs = jobs.filter(j => j.status === 'failed').length;
  const queueingJobs = jobs.filter(j => j.status === 'queueing' || j.status === 'idle').length;

  const progressPercent = totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0;

  // Calculate rate limit status
  const jobsInLastMinute = rateLimitHistory.length;
  const rateLimitRemaining = Math.max(0, 4 - jobsInLastMinute);

  useEffect(() => {
    if (rateLimitHistory.length >= 4) {
      const oldestStart = rateLimitHistory[0];
      const nextAllowedStart = oldestStart + 60000;
      const interval = setInterval(() => {
        const remainingMs = nextAllowedStart - Date.now();
        if (remainingMs <= 0) {
          setCooldownSeconds(0);
          clearInterval(interval);
        } else {
          setCooldownSeconds(Math.ceil(remainingMs / 1000));
        }
      }, 1000);

      return () => clearInterval(interval);
    } else {
      setCooldownSeconds(0);
    }
  }, [rateLimitHistory]);

  return (
    <div id="queue-progress-panel" className="bg-[#1E293B] border border-slate-800 rounded-lg p-4 shadow-md space-y-4">
      {/* Header with main controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h2 className="text-xs font-bold text-slate-100 flex items-center gap-1.5 uppercase tracking-wider">
            <Cpu className="w-4 h-4 text-indigo-400" />
            Điều Phối Hàng Đợi (Queue Coordinator)
          </h2>
          <p className="text-[10px] text-slate-400 font-medium">
            Tự động quản lý tiến trình, giới hạn luồng chạy song song và chống quá tải API.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          {isProcessing ? (
            <button
              id="pause-queue-btn"
              onClick={onStopProcessing}
              className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-3 py-1.5 rounded text-[10px] flex items-center gap-1 uppercase tracking-wider transition cursor-pointer"
            >
              <Pause className="w-3 h-3" />
              Tạm Dừng
            </button>
          ) : (
            <button
              id="start-queue-btn"
              onClick={onStartProcessing}
              disabled={totalJobs === 0 || completedJobs + failedJobs === totalJobs}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold px-3 py-1.5 rounded text-[10px] flex items-center gap-1 uppercase tracking-wider transition cursor-pointer"
            >
              <Play className="w-3 h-3" />
              Bắt Đầu
            </button>
          )}

          <button
            id="download-all-btn"
            onClick={handleDownloadAll}
            disabled={completedJobs === 0}
            className="bg-slate-850 hover:bg-slate-800 border border-slate-750 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 font-bold px-3 py-1.5 rounded text-[10px] flex items-center gap-1 uppercase tracking-wider transition cursor-pointer"
          >
            <Download className="w-3 h-3" />
            Tải Hết
          </button>

          <button
            id="clear-all-btn"
            onClick={onClearJobs}
            disabled={totalJobs === 0}
            className="bg-red-950/40 hover:bg-red-950/60 text-red-400 border border-red-900/30 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 rounded text-[10px] flex items-center gap-1 uppercase tracking-wider transition cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
            Xóa Toàn Bộ
          </button>
        </div>
      </div>

      {/* Queue Progress Bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
          <span className="text-slate-400">Tiến trình hoàn tất</span>
          <span className="text-indigo-400 font-mono">{progressPercent}% ({completedJobs}/{totalJobs} Jobs)</span>
        </div>
        <div className="w-full bg-[#0F172A] rounded h-2 overflow-hidden border border-slate-800 p-0.5">
          <div
            className="bg-gradient-to-r from-indigo-500 to-violet-500 h-full rounded transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Grid of Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <div className="bg-[#0F172A] border border-slate-800/80 rounded p-2 text-center">
          <span className="text-[9px] uppercase tracking-wider font-bold text-slate-500 block">Tổng số Job</span>
          <p className="text-sm font-bold text-slate-300 font-mono">{totalJobs}</p>
        </div>
        <div className="bg-[#0F172A] border border-slate-800/80 rounded p-2 text-center">
          <span className="text-[9px] uppercase tracking-wider font-bold text-amber-500 block">Đang chạy</span>
          <p className="text-sm font-bold text-amber-400 flex items-center justify-center gap-1 font-mono">
            {runningJobs}
            {runningJobs > 0 && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
          </p>
        </div>
        <div className="bg-[#0F172A] border border-slate-800/80 rounded p-2 text-center">
          <span className="text-[9px] uppercase tracking-wider font-bold text-blue-400 block">Chờ xử lý</span>
          <p className="text-sm font-bold text-blue-400 font-mono">{queueingJobs}</p>
        </div>
        <div className="bg-[#0F172A] border border-slate-800/80 rounded p-2 text-center">
          <span className="text-[9px] uppercase tracking-wider font-bold text-emerald-400 block">Thành công</span>
          <p className="text-sm font-bold text-emerald-400 font-mono">{completedJobs}</p>
        </div>
        <div className="bg-[#0F172A] border border-slate-800/80 rounded p-2 text-center col-span-2 md:col-span-1">
          <span className="text-[9px] uppercase tracking-wider font-bold text-red-400 block">Bị lỗi</span>
          <p className="text-sm font-bold text-red-400 font-mono">{failedJobs}</p>
        </div>
      </div>

      {/* Advanced Settings Row & Rate Limit Monitor */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800/50">
        {/* Settings */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1">
            <Cpu className="w-3 h-3 text-indigo-400" />
            Cấu hình công suất
          </h3>

          {/* Concurrency slider */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
              <span className="text-slate-400">Luồng song song tối đa (Concurrency):</span>
              <span className="text-indigo-400 font-mono">{config.concurrency} Jobs</span>
            </div>
            <input
              type="range"
              min={1}
              max={8}
              value={config.concurrency}
              onChange={(e) => onConfigChange({ ...config, concurrency: parseInt(e.target.value) || 1 })}
              className="w-full accent-indigo-500 bg-[#0F172A] h-1 rounded cursor-pointer"
            />
          </div>

          {/* Simulation Toggle */}
          <div className="flex items-center justify-between bg-[#0F172A] p-2 rounded border border-slate-800">
            <div className="space-y-0.5">
              <span className="block text-[10px] font-bold text-slate-300 uppercase tracking-wider">Mô phỏng (Demo Mode)</span>
              <span className="block text-[9px] text-slate-500 leading-none">
                {hasApiKey ? "Tắt để gửi yêu cầu thật đến Gemini API." : "Có thể tắt để chạy API thật (nếu có key sẵn)."}
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.simulate}
                onChange={(e) => onConfigChange({ ...config, simulate: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600 peer-checked:after:bg-white" />
            </label>
          </div>
        </div>

        {/* Rate Limit and API Key Alerts */}
        <div className="space-y-3 bg-[#0F172A] p-3 rounded border border-slate-800">
          <h3 className="text-[10px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1">
            <Clock className="w-3 h-3 text-indigo-400" />
            Giám sát giới hạn tần suất
          </h3>

          <div className="space-y-2">
            {/* Limit counter */}
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
              <span className="text-slate-400">Số Job khởi chạy (60 giây qua):</span>
              <span className={`font-mono px-1.5 py-0.5 rounded ${
                jobsInLastMinute >= 4 ? 'bg-amber-950 text-amber-400 border border-amber-900/40' : 'bg-[#1E293B] text-slate-300'
              }`}>
                {jobsInLastMinute} / 4 Jobs
              </span>
            </div>

            {/* Indicator blocks */}
            <div className="grid grid-cols-4 gap-1.5">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded transition-all duration-350 ${
                    i <= jobsInLastMinute
                      ? 'bg-amber-500 shadow-sm shadow-amber-500/20'
                      : 'bg-slate-800'
                  }`}
                />
              ))}
            </div>

            {/* Cooldown Timer Alert */}
            {cooldownSeconds > 0 ? (
              <div className="bg-amber-950/20 border border-amber-900/30 rounded p-2 flex items-start gap-2 text-amber-400 text-[10px]">
                <Clock className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 animate-pulse" />
                <div className="leading-tight">
                  <p className="font-bold uppercase tracking-wider">Đang dừng tạm thời (Cooldown)</p>
                  <p className="text-slate-400 text-[9px] mt-0.5">
                    Hàng đợi tạm dừng để tuân thủ giới hạn. Tự động chạy tiếp sau <span className="font-bold text-amber-400 font-mono text-xs">{cooldownSeconds}s</span>.
                  </p>
                </div>
              </div>
            ) : isProcessing ? (
              <div className="bg-emerald-950/20 border border-emerald-900/30 rounded p-2 flex items-start gap-2 text-emerald-400 text-[10px]">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <div className="leading-tight">
                  <p className="font-bold uppercase tracking-wider">Hàng đợi đang xử lý</p>
                  <p className="text-slate-400 text-[9px] mt-0.5">
                    Tốc độ xử lý bình thường (Đang trống: {rateLimitRemaining}/4).
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/50 border border-slate-800/80 rounded p-2 flex items-start gap-2 text-slate-400 text-[10px]">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <div className="leading-tight">
                  <p className="font-bold uppercase tracking-wider">Hàng đợi đã tạm dừng</p>
                  <p className="text-slate-500 text-[9px] mt-0.5">
                    Nhấn nút "Bắt Đầu" để tự động khởi chạy luồng xử lý video.
                  </p>
                </div>
              </div>
            )}

            {/* API key & simulation warnings */}
            {config.simulate ? (
              <div className="bg-blue-950/20 border border-blue-900/30 rounded p-2 flex items-start gap-2 text-blue-400 text-[9px] leading-relaxed">
                <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
                <p>
                  <strong>Chế độ mô phỏng đang bật:</strong> {!hasApiKey ? "Chưa thiết lập GEMINI_API_KEY. " : ""}Hệ thống đang giả lập quá trình tạo video từ Veo với các video mẫu trực quan.
                </p>
              </div>
            ) : (
              !hasApiKey && (
                <div className="bg-red-950/20 border border-red-900/30 rounded p-2 flex items-start gap-2 text-red-400 text-[9px] leading-relaxed">
                  <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
                  <p>
                    <strong>Cảnh báo:</strong> Bạn đã tắt chế độ mô phỏng nhưng chưa thiết lập <code>GEMINI_API_KEY</code>. Hãy thêm API Key trong mục Secrets của AI Studio để chạy API thật.
                  </p>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
