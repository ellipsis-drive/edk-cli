FROM ghcr.io/ellipsis-drive/gdal-python

COPY --chown=ellipsis:ellipsis requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=ellipsis:ellipsis . ./

ENTRYPOINT ["gunicorn", "--bind", "0.0.0.0:8000", "flaskServer:app"]