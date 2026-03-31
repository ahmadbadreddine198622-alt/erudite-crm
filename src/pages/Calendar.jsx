import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, MapPin, User } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay } from 'date-fns';

export default function Calendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    fetchCalendarEvents();
  }, [currentMonth]);

  const fetchCalendarEvents = async () => {
    setLoading(true);
    try {
      const response = await base44.functions.invoke('getCalendarEvents', {
        month: format(currentMonth, 'yyyy-MM')
      });
      setEvents(response.data.events || []);
    } catch (error) {
      console.error('Failed to fetch calendar events:', error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDate = days[0];
  const endDate = days[days.length - 1];
  const calendarDays = eachDayOfInterval({ 
    start: new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() - startDate.getDay()),
    end: new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() + (6 - endDate.getDay()))
  });

  const getEventsForDay = (day) => {
    return events.filter(event => isSameDay(new Date(event.start.dateTime), day));
  };

  const selectedDateEvents = selectedDate ? getEventsForDay(selectedDate) : [];

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Calendar" 
        subtitle="View all property viewing appointments"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-lg">
                {format(currentMonth, 'MMMM yyyy')}
              </CardTitle>
              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Day Headers */}
                <div className="grid grid-cols-7 gap-2 mb-4">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center text-xs font-semibold text-muted-foreground py-2">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Days */}
                <div className="grid grid-cols-7 gap-2">
                  {calendarDays.map((day, idx) => {
                    const dayEvents = getEventsForDay(day);
                    const isCurrentMonth = isSameMonth(day, currentMonth);
                    const isSelected = selectedDate && isSameDay(day, selectedDate);

                    return (
                      <button
                        key={idx}
                        onClick={() => setSelectedDate(day)}
                        className={`p-2 min-h-20 rounded-lg border-2 transition-all text-left text-sm ${
                          isSelected
                            ? 'border-accent bg-accent/10'
                            : dayEvents.length > 0
                            ? 'border-amber-300 bg-amber-50'
                            : 'border-border bg-muted/30'
                        } ${!isCurrentMonth ? 'opacity-40' : ''}`}
                      >
                        <div className={`font-semibold mb-1 ${!isCurrentMonth ? 'text-muted-foreground' : 'text-foreground'}`}>
                          {format(day, 'd')}
                        </div>
                        {dayEvents.length > 0 && (
                          <div className="space-y-1">
                            {dayEvents.slice(0, 2).map((event, i) => (
                              <div key={i} className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded truncate font-medium">
                                {format(new Date(event.start.dateTime), 'HH:mm')}
                              </div>
                            ))}
                            {dayEvents.length > 2 && (
                              <div className="text-[10px] text-muted-foreground">
                                +{dayEvents.length - 2} more
                              </div>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Selected Date Events */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarIcon className="w-4 h-4" />
                {selectedDate ? format(selectedDate, 'MMM d, yyyy') : 'Select a date'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedDateEvents.length > 0 ? (
                selectedDateEvents.map((event, idx) => (
                  <div key={idx} className="p-3 border rounded-lg bg-muted/30 space-y-2">
                    <p className="font-semibold text-sm line-clamp-2">{event.summary}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {format(new Date(event.start.dateTime), 'HH:mm')} - {format(new Date(event.end.dateTime), 'HH:mm')}
                    </div>
                    {event.description && (
                      <div className="text-xs text-muted-foreground bg-background p-2 rounded">
                        {event.description.split('\n').map((line, i) => (
                          <div key={i}>{line}</div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No appointments scheduled
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}