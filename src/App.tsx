import React, { useState, useEffect } from 'react';
import { Video, Sparkles, AlertCircle, RefreshCw, Layers, Server, Play, Pause, ExternalLink, Cpu } from 'lucide-react';
import CreateJobForm from './components/CreateJobForm';
import QueueProgress from './components/QueueProgress';
import JobList from './components/JobList';
import { VideoJob, QueueConfig } from './types';

export default function App() {
  const [jobs, setJobs] = useState<VideoJob[]>(() => {
    const saved = localStorage.getItem('gemini_video_jobs');
    return saved ? JSON.parse(saved) : [];
  });

  const [config, setConfig] = useState<QueueConfig>({
    concurrency: 4,
    simulate: true // default to simulation, we will update once we check status
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [serverStatus, setServerStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  
  // Rate limit timestamps history (holds start times of jobs run in the last 60 seconds)
  const [rateLimitHistory, setRateLimitHistory] = useState<number[]>([]);

  // 1. Fetch backend API key presence on boot
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/status');
        if (res.ok) {
          const data = await res.json();
          setHasApiKey(data.hasApiKey);
          setServerStatus('connected');
          // If we have an API key, turn off simulation by default so they use the real deal
          // Otherwise, force simulation mode
          setConfig(prev => ({
            ...prev,
            simulate: !data.hasApiKey
          }));
        } else {
          setServerStatus('error');
        }
      } catch (err) {
        console.error("Lỗi kết nối server:", err);
        setServerStatus('error');
      }
    };
    checkStatus();
  }, []);

  // 2. Persist jobs to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('gemini_video_jobs', JSON.stringify(jobs));
  }, [jobs]);

  // 3. Queue Scheduler: coordinates execution of pending jobs
  useEffect(() => {
    if (!isProcessing) return;

    // Filter rate limit history to keep only timestamps from the last 60 seconds
    const now = Date.now();
    const cleanHistory = rateLimitHistory.filter(t => now - t < 60000);
    if (cleanHistory.length !== rateLimitHistory.length) {
      setRateLimitHistory(cleanHistory);
      return;
    }

    const runningJobs = jobs.filter(j => j.status === 'running');
    if (runningJobs.length >= config.concurrency) {
      // Concurrency limit reached, wait for some job to finish
      return;
    }

    // Rate Limit Guard: TRong vòng 1 phút, chỉ được tối đa 4 jobs khởi chạy
    if (cleanHistory.length >= 4) {
      // Cooldown in progress, scheduler will sleep until history items expire
      return;
    }

    // Find the next idle job to run
    const nextJob = jobs.find(j => j.status === 'idle');
    if (!nextJob) {
      // No more idle jobs. If no jobs are running, stop processing.
      if (runningJobs.length === 0) {
        setIsProcessing(false);
      }
      return;
    }

    // Update history with current start time
    setRateLimitHistory(prev => [...prev, now]);

    // Transition job to running status in state
    setJobs(prevJobs =>
      prevJobs.map(j =>
        j.id === nextJob.id
          ? { ...j, status: 'running', startedAt: now, progress: 10 }
          : j
      )
    );

    // Call API in background
    triggerVideoGeneration(nextJob);

  }, [isProcessing, jobs, rateLimitHistory, config.concurrency, config.simulate]);

  // 4. Polling effect: queries progress of running operations from the server
  useEffect(() => {
    const pollInterval = setInterval(() => {
      const runningJobs = jobs.filter(j => j.status === 'running' && j.operationName);
      if (runningJobs.length === 0) return;

      runningJobs.forEach(async (job) => {
        try {
          const res = await fetch('/api/video-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ operationName: job.operationName })
          });

          if (!res.ok) {
            throw new Error(`HTTP error ${res.status}`);
          }

          const data = await res.json();

          if (data.done) {
            if (data.error) {
              setJobs(prev =>
                prev.map(j =>
                  j.id === job.id
                    ? { ...j, status: 'failed', error: data.error.message || 'Operation failed', progress: 100 }
                    : j
                )
              );
            } else {
              setJobs(prev =>
                prev.map(j =>
                  j.id === job.id
                    ? { ...j, status: 'completed', progress: 100, completedAt: Date.now() }
                    : j
                )
              );
            }
          } else {
            // Update progress (use server reported percentage, or increment smoothly up to 95%)
            const currentProgress = job.progress || 15;
            const nextProgress = data.progress !== undefined
              ? data.progress
              : Math.min(currentProgress + 4, 95);

            setJobs(prev =>
              prev.map(j =>
                j.id === job.id
                  ? { ...j, progress: nextProgress }
                  : j
              )
            );
          }
        } catch (err: any) {
          console.error("Lỗi khi kiểm tra tiến trình của job:", job.id, err);
          // We don't fail the job instantly on a transient network error to keep it robust
        }
      });
    }, 4000); // check status every 4 seconds

    return () => clearInterval(pollInterval);
  }, [jobs]);

  // 5. Trigger generation call on the backend
  const triggerVideoGeneration = async (job: VideoJob) => {
    try {
      const res = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: job.prompt,
          inputType: job.inputType,
          model: job.model,
          aspectRatio: job.aspectRatio,
          resolution: job.resolution,
          image: job.image,
          lastFrame: job.lastFrame,
          simulate: config.simulate
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server returned code ${res.status}`);
      }

      const data = await res.json();

      setJobs(prev =>
        prev.map(j =>
          j.id === job.id
            ? { ...j, operationName: data.operationName, progress: 20 }
            : j
        )
      );

    } catch (err: any) {
      console.error("Lỗi kích hoạt tạo video:", err);
      setJobs(prev =>
        prev.map(j =>
          j.id === job.id
            ? { ...j, status: 'failed', error: err.message || 'Lỗi không xác định', progress: 100 }
            : j
        )
      );
    }
  };

  // 6. Action Handlers
  const handleAddJobs = (newJobsData: Omit<VideoJob, 'id' | 'status' | 'progress' | 'createdAt'>[]) => {
    const formattedJobs: VideoJob[] = newJobsData.map(job => ({
      ...job,
      id: `job-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      status: 'idle',
      progress: 0,
      createdAt: Date.now()
    }));

    setJobs(prev => [...prev, ...formattedJobs]);
  };

  const handleRetryJob = (id: string) => {
    setJobs(prev =>
      prev.map(j =>
        j.id === id
          ? { ...j, status: 'idle', progress: 0, error: undefined, operationName: undefined }
          : j
      )
    );
    // Auto start queue when retry is clicked
    setIsProcessing(true);
  };

  const handleDeleteJob = (id: string) => {
    if (confirm("Bạn có chắc chắn muốn xóa nhiệm vụ này?")) {
      setJobs(prev => prev.filter(j => j.id !== id));
    }
  };

  const handleClearAll = () => {
    if (confirm("Bạn có chắc chắn muốn xóa toàn bộ danh sách nhiệm vụ và lịch sử?")) {
      setJobs([]);
      setIsProcessing(false);
      setRateLimitHistory([]);
    }
  };

  const handleDownloadAll = () => {
    const completed = jobs.filter(j => j.status === 'completed' && j.operationName);
    if (completed.length === 0) {
      alert("Không có video hoàn thành nào để tải xuống!");
      return;
    }

    if (confirm(`Bạn có chắc chắn muốn tải xuống đồng thời ${completed.length} video đã hoàn thành? Trình duyệt sẽ yêu cầu cấp quyền tải xuống hàng loạt.`)) {
      completed.forEach((job, index) => {
        setTimeout(() => {
          const downloadUrl = `/api/video/download?operationName=${encodeURIComponent(job.operationName!)}&filename=${encodeURIComponent(`gemini-video-${job.id}.mp4`)}`;
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = `gemini-video-${job.id}.mp4`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }, index * 1000); // Stagger download requests by 1s to prevent browser throttle
      });
    }
  };

  const idleOrWaitingCount = jobs.filter(j => j.status === 'idle' || j.status === 'queueing').length;
  const runningJobsCount = jobs.filter(j => j.status === 'running').length;
  const completedJobsCount = jobs.filter(j => j.status === 'completed').length;

  return (
    <div className="h-screen flex flex-col bg-[#0F172A] text-slate-200 font-sans overflow-hidden">
      {/* Header Section */}
      <header className="h-16 border-b border-slate-850 bg-[#1E293B] flex items-center justify-between px-6 shrink-0 z-40 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#52801C] rounded flex items-center justify-center shadow-md shadow-[#52801C]/20 overflow-hidden shrink-0">
            <svg viewBox="0 0 8 8" className="w-6 h-6 text-black fill-current">
              <rect x="1" y="1" width="2" height="2" />
              <rect x="5" y="1" width="2" height="2" />
              <rect x="3" y="3" width="2" height="2" />
              <rect x="2" y="4" width="4" height="2" />
              <rect x="3" y="5" width="2" height="1" fill="#52801C" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight flex items-center gap-2">
              Tools Video
              <span className="text-[9px] bg-slate-900 text-indigo-400 font-mono px-1.5 py-0.5 rounded border border-slate-800">
                cre bachmai
              </span>
              <span className="text-[9px] bg-slate-900 text-slate-400 font-mono px-1.5 py-0.5 rounded border border-slate-800">
                v3.1
              </span>
            </h1>
            <p className="text-[10px] text-slate-500 font-medium">Hệ thống gửi Job hàng loạt qua Google Gemini AI (Veo) • cre: bachmai</p>
          </div>
        </div>

        {/* Dynamic Engine Stats Indicators */}
        <div className="flex items-center gap-6">
          <div className="hidden sm:flex gap-6 border-r border-slate-800 pr-6">
            <div className="text-center">
              <p className="text-[9px] uppercase text-slate-500 font-bold leading-none">Hàng đợi (Queue)</p>
              <p className="text-xs font-mono font-semibold mt-1 text-slate-300">
                {idleOrWaitingCount}/{jobs.length}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[9px] uppercase text-slate-500 font-bold leading-none">Đang chạy (Active)</p>
              <p className={`text-xs font-mono font-semibold mt-1 ${runningJobsCount > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                {String(runningJobsCount).padStart(2, '0')}/{String(config.concurrency).padStart(2, '0')}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[9px] uppercase text-slate-500 font-bold leading-none">Giới hạn (Limit)</p>
              <p className="text-xs font-mono font-semibold mt-1 text-amber-400">4/min</p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadAll}
              disabled={completedJobsCount === 0}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded text-[11px] font-medium border border-slate-750 transition text-slate-300"
            >
              Tải Tất Cả
            </button>

            {isProcessing ? (
              <button
                onClick={() => setIsProcessing(false)}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 rounded text-[11px] font-bold text-white shadow-md shadow-amber-950/20 transition"
              >
                Tạm Dừng
              </button>
            ) : (
              <button
                onClick={() => setIsProcessing(true)}
                disabled={jobs.length === 0 || completedJobsCount + jobs.filter(j => j.status === 'failed').length === jobs.length}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-45 disabled:cursor-not-allowed rounded text-[11px] font-bold text-white shadow-md shadow-indigo-950/20 transition"
              >
                Bắt Đầu
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Split Layout */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Sidebar: Configuration Form */}
        <aside className="w-full lg:w-[350px] border-b lg:border-b-0 lg:border-r border-slate-800 bg-[#0F172A] p-4 flex flex-col gap-4 shrink-0 overflow-y-auto high-density-scrollbar">
          <div className="flex-1">
            <CreateJobForm onAddJobs={handleAddJobs} hasApiKey={hasApiKey} />
          </div>
          
          {/* Server status built into bottom of sidebar for compact styling */}
          <div className="p-3 bg-slate-900/60 border border-slate-850 rounded-lg flex items-center justify-between text-xs mt-auto">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Server className="w-3.5 h-3.5 text-indigo-400" />
              <span>Kết nối máy chủ</span>
            </div>
            <div>
              {serverStatus === 'checking' && (
                <span className="text-slate-500 flex items-center gap-1 font-medium text-[11px]">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Đang nối...
                </span>
              )}
              {serverStatus === 'connected' && (
                <span className="text-emerald-400 bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-900/10 font-bold text-[10px] uppercase">
                  Hoạt động
                </span>
              )}
              {serverStatus === 'error' && (
                <span className="text-red-400 bg-red-950/20 px-2 py-0.5 rounded border border-red-900/10 font-bold text-[10px] uppercase">
                  Mất kết nối
                </span>
              )}
            </div>
          </div>
        </aside>

        {/* Right Content Area: Queue Dashboard and Monitor */}
        <section className="flex-1 bg-[#020617] p-4 flex flex-col gap-4 overflow-y-auto high-density-scrollbar">
          {/* Intro Tip banner - compact, highly styling */}
          <div className="bg-slate-900/30 border border-slate-850 rounded-lg p-3 flex items-start gap-3">
            <div className="p-1 bg-indigo-600/10 border border-indigo-500/20 rounded text-indigo-400 flex-shrink-0">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div className="text-[11px] text-slate-400 leading-relaxed">
              <strong>Hệ thống tạo video hàng loạt thông minh:</strong> Nhập từ 20 đến 50 prompts cùng lúc. Hệ thống tự động giới hạn luồng song song và cooldown thông minh để đảm bảo tối đa <strong>4 jobs/phút</strong>.
            </div>
          </div>

          <QueueProgress
            jobs={jobs}
            config={config}
            onConfigChange={setConfig}
            isProcessing={isProcessing}
            onStartProcessing={() => setIsProcessing(true)}
            onStopProcessing={() => setIsProcessing(false)}
            onClearJobs={handleClearAll}
            hasApiKey={hasApiKey}
            rateLimitHistory={rateLimitHistory}
            handleDownloadAll={handleDownloadAll}
          />

          <JobList
            jobs={jobs}
            onRetryJob={handleRetryJob}
            onDeleteJob={handleDeleteJob}
          />
        </section>
      </main>

      {/* Footer Status Bar */}
      <footer className="h-8 border-t border-slate-850 bg-[#1E293B] flex items-center justify-between px-6 shrink-0 z-40 text-[11px] text-slate-400 font-medium">
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse" />
            <span className="text-[10px] uppercase font-bold text-slate-400">Trạng thái: Bình thường</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">Phản hồi: 142ms</span>
        </div>
        <div className="text-[10px] text-slate-500 uppercase font-bold">
          Powered by <span className="text-indigo-400">Google Gemini AI</span> • Veo Engine v1.0.4-build • <span className="text-indigo-400">cre bachmai</span>
        </div>
      </footer>
    </div>
  );
}
