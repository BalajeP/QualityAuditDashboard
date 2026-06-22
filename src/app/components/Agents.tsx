import { useState } from "react";
import { useData } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";
import {
  Plus,
  Edit2,
  Trash2,
  Mail,
  Users as UsersIcon,
  X,
  Save,
} from "lucide-react";
import { Agent } from "../types";
import { toast } from "sonner";

export function Agents() {
  const { isAdmin } = useAuth();
  const { agents, addAgent, updateAgent, deleteAgent, audits } =
    useData();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(
    null,
  );
  const SHIFTS = ["Morning", "Afternoon", "Night"];

  const [formData, setFormData] = useState<Partial<Agent>>({
    name: "",
    email: "",
    team: "Morning",
    status: "active",
  });

  const handleSubmit = (e: React.FormEvent) => {
    if (!isAdmin) {
      toast.error("You do not have permission to modify agents.");
      return;
    }
    e.preventDefault();

    if (!formData.name) {
      toast.error("Please enter the agent name");
      return;
    }

    const duplicateAgent = agents
      .filter((a) => a.id !== editingId)
      .some(
        (a) =>
          a.name.trim().toLowerCase() ===
          formData.name?.trim().toLowerCase(),
      );

    if (duplicateAgent) {
      toast.error("Agent already exists");
      return;
    }

    if (editingId) {
      updateAgent({
        ...formData,
        id: editingId,
        name: formData.name.trim(),
        email: formData.email?.trim() || "",
      } as Agent);
      toast.success("Agent updated successfully");
      setEditingId(null);
    } else {
      addAgent({
        name: formData.name.trim(),
        email: formData.email?.trim() || "",
        team: formData.team || "Morning",
        status: formData.status || "active",
        id: `agent-${Date.now()}`,
      } as Agent);
      toast.success("Agent added successfully");
      setIsAdding(false);
    }

    setFormData({
      name: "",
      email: "",
      team: "Morning",
      status: "active",
    });
  };

  const handleEdit = (agent: Agent) => {
    if (!isAdmin) return;
    setEditingId(agent.id);
    setFormData(agent);
    setIsAdding(false);
  };

  const handleDelete = (id: string) => {
    if (!isAdmin) return;
    const agentAudits = audits.filter((a) => a.agentId === id);
    if (agentAudits.length > 0) {
      if (
        !confirm(
          `This agent has ${agentAudits.length} audit(s). Delete anyway?`,
        )
      ) {
        return;
      }
    }
    deleteAgent(id);
    toast.success("Agent deleted");
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({
      name: "",
      email: "",
      team: "Morning",
      status: "active",
    });
  };

  const getAgentStats = (agentId: string) => {
    const agentAudits = audits.filter(
      (a) => a.agentId === agentId,
    );
    const avgScore =
      agentAudits.length > 0
        ? agentAudits.reduce(
            (sum, a) => sum + a.percentage,
            0,
          ) / agentAudits.length
        : 0;
    return { count: agentAudits.length, avgScore };
  };

  const uniqueAgents = agents.filter(
    (agent, index, self) =>
      index ===
      self.findIndex(
        (a) =>
          a.name.trim().toLowerCase() ===
          agent.name.trim().toLowerCase(),
      ),
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">
            Agent Management
          </h2>
          <p className="text-slate-600 mt-1">
            {agents.length} total agents
          </p>
        </div>
        {!isAdding && !editingId && isAdmin && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="size-4" />
            Add Agent
          </button>
        )}
      </div>

      {/* Agents List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-slate-100 font-medium text-slate-700 text-sm">
          <div className={isAdmin ? "col-span-3" : "col-span-4"}>Agent</div>
          <div className={isAdmin ? "col-span-3" : "col-span-4"}>Email</div>
          <div className="col-span-2">Shift</div>
          <div className="col-span-2">Status</div>
          {isAdmin && <div className="col-span-2 text-right">Actions</div>}
        </div>

        {/* Add Agent Form Row */}
        {isAdding && (
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-slate-200 items-center bg-blue-50/30"
          >
            {/* Name */}
            <div className="col-span-3">
              <input
                autoFocus
                placeholder="Agent full name"
                value={formData.name || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    name: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border rounded-lg bg-white text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
              />
            </div>

            {/* Email */}
            <div className="col-span-3">
              <input
                type="email"
                placeholder="Email (optional)"
                value={formData.email || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    email: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border rounded-lg bg-white text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
              />
            </div>

            {/* Shift */}
            <div className="col-span-2">
              <select
                value={formData.team || "Morning"}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    team: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border rounded-lg bg-white text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
              >
                {SHIFTS.map((shift) => (
                  <option key={shift} value={shift}>
                    {shift}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div className="col-span-2">
              <select
                value={formData.status || "active"}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    status: e.target.value as "active" | "inactive",
                  })
                }
                className="w-full px-3 py-2 border rounded-lg bg-white text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {/* Actions */}
            <div className="col-span-2 flex justify-end gap-2">
              <button
                type="submit"
                className="p-2 rounded-lg text-green-600 hover:bg-green-50 transition-colors animate-pulse"
                title="Save"
              >
                <Save className="size-5" />
              </button>

              <button
                type="button"
                onClick={handleCancel}
                className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                title="Cancel"
              >
                <X className="size-5" />
              </button>
            </div>
          </form>
        )}

        {uniqueAgents.map((agent) => {
          const isEditing = editingId === agent.id;

          return (
            <div
              key={agent.id}
              className="grid grid-cols-12 gap-4 px-4 py-3 border-t border-slate-200 items-center hover:bg-slate-50"
            >
              {/* Name */}
              <div className={isAdmin ? "col-span-3" : "col-span-4"}>
                {isEditing ? (
                  <input
                    value={formData.name || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        name: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                ) : (
                  <span className="font-medium">
                    {agent.name}
                  </span>
                )}
              </div>

              {/* Email */}
              <div className={isAdmin ? "col-span-3" : "col-span-4"}>
                {isEditing ? (
                  <input
                    type="email"
                    value={formData.email || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        email: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                ) : (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Mail className="size-4" />
                    {agent.email}
                  </div>
                )}
              </div>

              {/* Shift */}
              <div className="col-span-2">
                {isEditing ? (
                  <select
                    value={formData.team || "Morning"}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        team: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {SHIFTS.map((shift) => (
                      <option key={shift} value={shift}>
                        {shift}
                      </option>
                    ))}
                  </select>
                ) : (
                  agent.team
                )}
              </div>

              {/* Status */}
              <div className="col-span-2">
                {isEditing ? (
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        status: e.target.value as
                          | "active"
                          | "inactive",
                      })
                    }
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                ) : (
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${
                      agent.status === "active"
                        ? "bg-green-100 text-green-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {agent.status}
                  </span>
                )}
              </div>

              {/* Actions */}
              {isAdmin && (
                <div className="col-span-2 flex justify-end gap-2">
                  {isEditing ? (
                    <>
                      <button
                        onClick={(e) => handleSubmit(e as any)}
                        className="p-2 rounded-lg text-green-600 hover:bg-green-50"
                        title="Save"
                      >
                        <Save className="size-5" />
                      </button>

                      <button
                        onClick={handleCancel}
                        className="p-2 rounded-lg text-red-600 hover:bg-red-50"
                        title="Cancel"
                      >
                        <X className="size-5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleEdit(agent)}
                        className="p-2 rounded-lg text-blue-600 hover:bg-blue-50"
                        title="Edit"
                      >
                        <Edit2 className="size-4" />
                      </button>

                      <button
                        onClick={() => handleDelete(agent.id)}
                        className="p-2 rounded-lg text-red-600 hover:bg-red-50"
                        title="Delete"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {uniqueAgents.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <UsersIcon className="size-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600">
            No agents yet. Add your first agent to get started!
          </p>
        </div>
      )}
    </div>
  );
}