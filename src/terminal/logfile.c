/* Copyright (c) 2008, 2009
 *      Juergen Weigert (jnweiger@immd4.informatik.uni-erlangen.de)
 *      Michael Schroeder (mlschroe@immd4.informatik.uni-erlangen.de)
 *      Micah Cowan (micah@cowan.name)
 *      Sadrul Habib Chowdhury (sadrul@users.sourceforge.net)
 * Copyright (c) 1993-2002, 2003, 2005, 2006, 2007
 *      Juergen Weigert (jnweiger@immd4.informatik.uni-erlangen.de)
 *      Michael Schroeder (mlschroe@immd4.informatik.uni-erlangen.de)
 * Copyright (c) 1987 Oliver Laumann
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 3, or (at your option)
 * any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program (see the file COPYING); if not, see
 * https://www.gnu.org/licenses/, or contact Free Software Foundation, Inc.,
 * 51 Franklin Street, Fifth Floor, Boston, MA  02111-1301  USA
 *
 ****************************************************************
 */

#include "config.h"

#include "logfile.h"

#include <sys/types.h>		/* dev_t, ino_t, off_t, ... */
#include <sys/stat.h>		/* struct stat */
#include <fcntl.h>		/* O_WRONLY for logfile_reopen */
#include <stdint.h>
#include <stdbool.h>
#include <string.h>		/* memcpy for write buffering */

#include "screen.h"

#include "misc.h"

static void changed_logfile(Log *);
static Log *lookup_logfile(char *);
static int stolen_logfile(Log *);

static Log *logroot = NULL;

/*
 * Update cached stat info if file has grown.
 * Called only periodically now (every LOG_STAT_CHECK_INTERVAL flushes)
 * to reduce fstat() syscall overhead.
 */
static void changed_logfile(Log *l)
{
	struct stat o, *s = l->st;

	if (fstat(fileno(l->fp), &o) < 0)	/* get trouble later */
		return;
	if (o.st_size > s->st_size) {	/* aha, appended text */
		s->st_size = o.st_size;	/* this should have changed */
		s->st_mtime = o.st_mtime;	/* only size and mtime */
	}
}

/*
 * Check if periodic stat is due and perform it.
 * Returns 1 if logfile was stolen and needs reopen, 0 otherwise.
 */
static int periodic_stat_check(Log *l)
{
	if (--l->stat_countdown > 0)
		return 0;	/* not time yet */

	l->stat_countdown = LOG_STAT_CHECK_INTERVAL;

	if (stolen_logfile(l))
		return 1;

	changed_logfile(l);
	return 0;
}

/*
 * Flush the write buffer to disk.
 * Returns 0 on success, -1 on failure.
 */
static int flush_log_buffer(Log *l)
{
	if (!l->buffer || l->buflen == 0)
		return 0;

	if (fwrite(l->buffer, l->buflen, 1, l->fp) != 1) {
		l->buflen = 0;
		return -1;
	}

	l->buflen = 0;
	l->writecount++;
	return 0;
}

/*
 * Requires fd to be open and need_fd to be closed.
 * If possible, need_fd will be open afterwards and refer to
 * the object originally reffered by fd. fd will be closed then.
 * Works just like ``fcntl(fd, DUPFD, need_fd); close(fd);''
 *
 * need_fd is returned on success, else -1 is returned.
 */
int lf_move_fd(int fd, int need_fd)
{
	int r = -1;

	if (fd == need_fd)
		return fd;
	if (fd >= 0 && fd < need_fd)
		r = lf_move_fd(dup(fd), need_fd);
	close(fd);
	return r;
}

static int logfile_reopen(char *name, int wantfd, Log *l)
{
	int got_fd;

	close(wantfd);
	if (((got_fd = open(name, O_WRONLY | O_CREAT | O_APPEND, 0666)) < 0) || lf_move_fd(got_fd, wantfd) < 0) {
		logfclose(l);
		return -1;
	}
	changed_logfile(l);
	return 0;
}

static int (*lf_reopen_fn) (char *, int, struct Log *) = logfile_reopen;

/*
 * Whenever logfwrite discoveres that it is required to close and
 * reopen the logfile, the function registered here is called.
 * If you do not register anything here, the above logfile_reopen()
 * will be used instead.
 * Your function should perform the same steps as logfile_reopen():
 * a) close the original filedescriptor without flushing any output
 * b) open a new logfile for future output on the same filedescriptor number.
 * c) zero out st_dev, st_ino to tell the stolen_logfile() indcator to
 *    reinitialise itself.
 * d) return 0 on success.
 */
void logreopen_register(int (*fn) (char *, int, struct Log *))
{
	lf_reopen_fn = fn ? fn : logfile_reopen;
}

/*
 * If the logfile has been removed, truncated, unlinked or the like,
 * return nonzero.
 * The l->st structure initialised by logfopen is updated
 * on every call.
 */
static int stolen_logfile(Log *l)
{
	struct stat o, *s = l->st;

	o = *s;
	if (fstat(fileno(l->fp), s) < 0)	/* remember that stat failed */
		s->st_ino = s->st_dev = 0;
	if (!o.st_dev && !o.st_ino)	/* nothing to compare with */
		return 0;

	if ((!s->st_dev && !s->st_ino) ||	/* stat failed, that's new! */
	    !s->st_nlink ||	/* red alert: file unlinked */
	    (s->st_size < o.st_size) ||	/*           file truncated */
	    (s->st_mtime != o.st_mtime) ||	/*            file modified */
	    ((s->st_ctime != o.st_ctime) &&	/*     file changed (moved) */
	     !(s->st_mtime == s->st_ctime &&	/*  and it was not a change */
	       o.st_ctime < s->st_ctime))) {	/* due to delayed nfs write */
		return -1;
	}

	return 0;
}

static Log *lookup_logfile(char *name)
{
	Log *l;

	for (l = logroot; l; l = l->next)
		if (!strcmp(name, l->name))
			return l;
	return NULL;
}

Log *logfopen(char *name, FILE * fp)
{
	Log *l;

	if (!fp) {
		if (!(l = lookup_logfile(name)))
			return NULL;
		l->opencount++;
		return l;
	}

	if (!(l = calloc(1, sizeof(Log))))
		return NULL;
	if (!(l->st = calloc(1, sizeof(struct stat)))) {
		free((char *)l);
		return NULL;
	}

	if (!(l->name = SaveStr(name))) {
		free((char *)l->st);
		free((char *)l);
		return NULL;
	}
	l->fp = fp;
	l->opencount = 1;
	l->writecount = 0;
	l->flushcount = 0;
	/* Initialize buffering fields */
	l->buffer = NULL;	/* allocated lazily on first write */
	l->buflen = 0;
	l->stat_countdown = LOG_STAT_CHECK_INTERVAL;
	changed_logfile(l);

	l->next = logroot;
	logroot = l;
	return l;
}

int islogfile(char *name)
{
	if (!name)
		return logroot ? 1 : 0;
	return lookup_logfile(name) ? 1 : 0;
}

int logfclose(Log *l)
{
	Log **lp;

	for (lp = &logroot; *lp; lp = &(*lp)->next)
		if (*lp == l)
			break;

	if (!*lp)
		return -1;

	if ((--l->opencount) > 0)
		return 0;
	if (l->opencount < 0)
		abort();

	*lp = l->next;
	/* Flush any buffered data before closing */
	if (l->buffer && l->buflen > 0) {
		fwrite(l->buffer, l->buflen, 1, l->fp);
	}
	fclose(l->fp);
	free(l->buffer);	/* free write buffer if allocated */
	free(l->name);
	free((char *)l->st);
	free((char *)l);
	return 0;
}

/*
 * Write to logfile with buffering optimization.
 * Small writes are accumulated in a buffer and flushed when:
 * - Buffer is full (LOG_BUFFER_SIZE bytes)
 * - Incoming data is larger than remaining buffer space
 * - logfflush() is called
 *
 * Stat checks are now periodic (every LOG_STAT_CHECK_INTERVAL flushes)
 * instead of every write, reducing fstat() syscall overhead significantly.
 */
int logfwrite(Log *l, char *buf, size_t n)
{
	/* Lazy buffer allocation on first write */
	if (!l->buffer) {
		l->buffer = malloc(LOG_BUFFER_SIZE);
		if (!l->buffer) {
			/* Fall back to unbuffered write on alloc failure */
			return fwrite(buf, n, 1, l->fp);
		}
		l->buflen = 0;
	}

	/* If data fits in buffer, just buffer it */
	if (l->buflen + n <= LOG_BUFFER_SIZE) {
		memcpy(l->buffer + l->buflen, buf, n);
		l->buflen += n;
		return 1;	/* success */
	}

	/* Buffer would overflow - flush it first */
	/* Periodic stat check only on buffer flush, not every write */
	if (periodic_stat_check(l) && lf_reopen_fn(l->name, fileno(l->fp), l))
		return -1;

	if (flush_log_buffer(l) < 0)
		return -1;

	/* If new data fits in empty buffer, buffer it */
	if (n <= LOG_BUFFER_SIZE) {
		memcpy(l->buffer, buf, n);
		l->buflen = n;
		return 1;
	}

	/* Data larger than buffer - write directly */
	if (fwrite(buf, n, 1, l->fp) != 1)
		return -1;
	l->writecount++;
	l->flushcount = 0;
	return 1;
}

int logfflush(Log *l)
{
	int r = 0;

	if (!l) {
		/* Flush all logfiles */
		for (l = logroot; l; l = l->next) {
			/* Periodic stat check on flush */
			if (periodic_stat_check(l) && lf_reopen_fn(l->name, fileno(l->fp), l))
				return -1;
			/* Flush our write buffer first */
			if (flush_log_buffer(l) < 0)
				return -1;
			r |= fflush(l->fp);
			l->flushcount++;
		}
	} else {
		/* Flush specific logfile */
		if (periodic_stat_check(l) && lf_reopen_fn(l->name, fileno(l->fp), l))
			return -1;
		/* Flush our write buffer first */
		if (flush_log_buffer(l) < 0)
			return -1;
		r = fflush(l->fp);
		l->flushcount++;
	}
	return r;
}
