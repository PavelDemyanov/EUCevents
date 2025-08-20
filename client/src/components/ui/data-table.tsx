import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";

interface Column<T> {
  key: keyof T;
  header: string;
  sortable?: boolean;
  editable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  searchPlaceholder?: string;
  searchKey?: keyof T;
  filters?: {
    key: keyof T;
    label: string;
    options: { value: string; label: string }[];
  }[];
  pageSize?: number;
  onCellEdit?: (rowId: any, column: keyof T, value: any) => void;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  searchPlaceholder = "Поиск...",
  searchKey,
  filters = [],
  pageSize = 10,
  onCellEdit,
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    key: keyof T;
    direction: "asc" | "desc";
  } | null>(null);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [editingCell, setEditingCell] = useState<{
    rowIndex: number;
    column: keyof T;
  } | null>(null);
  const [editValue, setEditValue] = useState("");

  // Apply search filter
  const filteredData = data.filter((item) => {
    if (searchTerm && searchKey) {
      const searchValue = String(item[searchKey]).toLowerCase();
      if (!searchValue.includes(searchTerm.toLowerCase())) {
        return false;
      }
    }

    // Apply other filters
    for (const filter of filters) {
      const filterValue = filterValues[String(filter.key)];
      if (filterValue && filterValue !== "" && filterValue !== "all") {
        if (String(item[filter.key]) !== filterValue) {
          return false;
        }
      }
    }

    return true;
  });

  // Apply sorting
  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortConfig) return 0;

    const aValue = a[sortConfig.key];
    const bValue = b[sortConfig.key];

    if (aValue < bValue) {
      return sortConfig.direction === "asc" ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortConfig.direction === "asc" ? 1 : -1;
    }
    return 0;
  });

  // Apply pagination
  const totalPages = Math.ceil(sortedData.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedData = sortedData.slice(startIndex, startIndex + pageSize);

  const handleSort = (key: keyof T) => {
    setSortConfig((current) => {
      if (current?.key === key) {
        return {
          key,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }
      return { key, direction: "asc" };
    });
  };

  const handleFilterChange = (filterKey: string, value: string) => {
    setFilterValues((prev) => ({
      ...prev,
      [filterKey]: value,
    }));
    setCurrentPage(1);
  };

  const handleCellClick = (rowIndex: number, column: keyof T, currentValue: any) => {
    setEditingCell({ rowIndex, column });
    setEditValue(String(currentValue || ""));
  };

  const handleSaveEdit = (row: T, column: keyof T) => {
    if (onCellEdit && (row as any).id) {
      onCellEdit((row as any).id, column, editValue);
    }
    setEditingCell(null);
    setEditValue("");
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        {searchKey && (
          <Input
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="flex-1 md:max-w-sm"
          />
        )}
        <div className="flex flex-col md:flex-row gap-2 md:gap-4">
          {filters.map((filter) => (
            <Select
              key={String(filter.key)}
              value={filterValues[String(filter.key)] || ""}
              onValueChange={(value) => handleFilterChange(String(filter.key), value)}
            >
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder={filter.label} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все</SelectItem>
                {filter.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead
                  key={String(column.key)}
                  className={`${column.sortable ? "cursor-pointer hover:bg-gray-50" : ""} whitespace-nowrap`}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  <div className="flex items-center space-x-1">
                    <span className="text-xs md:text-sm">{column.header}</span>
                    {column.sortable && (
                      <ArrowUpDown className="h-3 w-3 md:h-4 md:w-4" />
                    )}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.map((row, index) => (
              <TableRow key={index}>
                {columns.map((column) => (
                  <TableCell key={String(column.key)}>
                    {column.editable && 
                     editingCell?.rowIndex === index && 
                     editingCell?.column === column.key ? (
                      <div className="flex items-center space-x-2">
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleSaveEdit(row, column.key);
                            }
                            if (e.key === 'Escape') {
                              setEditingCell(null);
                            }
                          }}
                          onBlur={() => handleSaveEdit(row, column.key)}
                          autoFocus
                          className="h-8 text-sm"
                        />
                      </div>
                    ) : (
                      <div 
                        className={column.editable ? "cursor-pointer hover:bg-gray-50 p-1 rounded" : ""}
                        onClick={() => column.editable && handleCellClick(index, column.key, row[column.key])}
                      >
                        {column.render
                          ? column.render(row[column.key], row)
                          : String(row[column.key] || "")}
                      </div>
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {paginatedData.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-center py-8 text-gray-500"
                >
                  Данные не найдены
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Показано {startIndex + 1} до {Math.min(startIndex + pageSize, sortedData.length)} из{" "}
            {sortedData.length} записей
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Предыдущая
            </Button>
            <span className="text-sm text-gray-700">
              Страница {currentPage} из {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              Следующая
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
